/**
 * Course content for admins (SPEC §4, §6 admin routes, §8.5). Every write checks ownership: a content
 * admin changes only the courses they created; a super admin changes any course (SECURITY §2).
 *
 * Writes use explicit field lists and every lesson or question is validated before it is stored. The
 * rich-text and upload rules come from SECURITY §4 and §7.
 */
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import {
  COURSE_STATUS,
  ERROR_CODES,
  LESSON_TYPES,
  ROLES,
  DEFAULT_PASS_MARK,
} from '@pollwise/shared/constants';
import { XP } from '@pollwise/shared/xp';
import { questionSchema, validateRichText } from '@pollwise/shared/schemas';
import { Assessment, Course, Enrollment, Lesson, Module, Upload } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { recordAudit } from './auditService.js';
import { assignQuestionIds } from '../domain/questionIds.js';
import { publishProblems } from '../domain/publishChecklist.js';
import {
  serializeLessonForLearner,
  serializeQuestionForLearner,
  presentationFor,
} from '../domain/serializers.js';
import { getSettings } from './settingsService.js';

const isSuper = (actor) => actor.role === ROLES.SUPER_ADMIN;
const oid = (value) => new mongoose.Types.ObjectId(String(value));

const forbidden = () =>
  new HttpError(
    403,
    ERROR_CODES.FORBIDDEN,
    'Only the author of this course or a super admin can change it.'
  );
const notFound = (what) =>
  new HttpError(404, ERROR_CODES.NOT_FOUND, `That ${what} does not exist.`);

/** @param {string} title */
export function slugFor(title) {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'course'}-${randomBytes(3).toString('hex')}`;
}

/** Visibility for reads: a content admin sees their own courses and any published course. */
function visibleTo(actor, course) {
  return (
    isSuper(actor) ||
    String(course.createdBy) === actor.id ||
    course.status === COURSE_STATUS.PUBLISHED
  );
}

function assertCanEdit(actor, course) {
  if (!(isSuper(actor) || String(course.createdBy) === actor.id)) throw forbidden();
}

async function loadCourse(id) {
  const course = await Course.findById(id);
  if (!course) throw notFound('course');
  return course;
}

/** Load a module and its course together, for lesson and assessment routes. */
async function loadModuleAndCourse(moduleId) {
  const mod = await Module.findById(moduleId);
  if (!mod) throw notFound('module');
  const course = await loadCourse(mod.courseId);
  return { mod, course };
}

/** Summary used in lists. Never includes answer keys. */
export function courseSummary(course) {
  return {
    id: String(course._id),
    title: course.title,
    slug: course.slug,
    summary: course.summary,
    category: course.category,
    targetRoles: course.targetRoles,
    isRequired: course.isRequired,
    estimatedMinutes: course.estimatedMinutes,
    status: course.status,
    coverImage: course.coverImage?.url ? { url: course.coverImage.url } : null,
    moduleCount: course.moduleIds?.length ?? 0,
    createdBy: String(course.createdBy),
    updatedAt: course.updatedAt,
    publishedAt: course.publishedAt ?? null,
  };
}

/** A cover image must be a confirmed upload of this course (SECURITY §7). */
async function resolveCoverImage(courseId, cover) {
  if (!cover) return null;
  const upload = await Upload.findOne({
    publicId: cover.publicId,
    courseId: oid(courseId),
    kind: 'image',
    confirmedAt: mongoose.trusted({ $ne: null }),
  }).lean();
  if (!upload) {
    throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Upload the cover image first.', [
      { path: 'coverImage', message: 'Upload the cover image with the upload button.' },
    ]);
  }
  return { url: upload.url, publicId: upload.publicId };
}

/* ------------------------------------------------------------------ courses */

export async function createCourse(ctx, actor, input, meta) {
  // The cover image is attached afterwards (PATCH), once the course exists to upload against.
  const course = await Course.create({
    ...input,
    coverImage: null,
    slug: slugFor(input.title),
    createdBy: oid(actor.id),
    updatedBy: oid(actor.id),
    moduleIds: [],
  });
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'course.create',
    targetType: 'course',
    targetId: course._id,
    ip: meta.ip,
  });
  return courseSummary(course);
}

/**
 * List courses. Content admins see their own plus published; super admins see everything.
 * @param {{ status?: string, q?: string, page: number, limit: number }} query
 */
export async function listCourses(ctx, actor, query) {
  const conditions = [];
  if (!isSuper(actor)) {
    conditions.push({ $or: [{ createdBy: oid(actor.id) }, { status: COURSE_STATUS.PUBLISHED }] });
  }
  if (query.status) conditions.push({ status: query.status });
  if (query.q) {
    const pattern = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    conditions.push({ $or: [{ title: pattern }, { summary: pattern }] });
  }
  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Course.countDocuments(filter),
  ]);
  return {
    items: items.map((c) => courseSummary(c)),
    page: query.page,
    limit: query.limit,
    total,
  };
}

/** Full admin tree: course, modules in order, lesson summaries, assessment summaries. */
export async function getCourseTree(ctx, actor, id) {
  const course = await loadCourse(id);
  if (!visibleTo(actor, course)) throw notFound('course');
  const tree = await loadTree(course);
  return {
    ...courseSummary(course),
    description: course.description ?? null,
    modules: tree.modules.map((m) => ({
      id: String(m._id),
      title: m.title,
      description: m.description ?? null,
      order: m.order,
      lessons: m.lessons.map((l) => ({
        id: String(l._id),
        title: l.title,
        type: l.type,
        order: l.order,
        xp: l.xp,
      })),
      assessment: m.assessment
        ? {
            id: String(m.assessment._id),
            title: m.assessment.title,
            questionCount: m.assessment.questions.length,
            passMark: m.assessment.passMark ?? null,
          }
        : null,
    })),
  };
}

/** Load modules (in order), their lessons (in order) and assessments as plain objects. */
async function loadTree(course) {
  const modules = await Module.find({ courseId: course._id }).lean();
  const byId = new Map(modules.map((m) => [String(m._id), m]));
  const ordered = course.moduleIds.map((id) => byId.get(String(id))).filter(Boolean);

  const lessons = await Lesson.find({
    moduleId: mongoose.trusted({ $in: ordered.map((m) => m._id) }),
  }).lean();
  const assessments = await Assessment.find({
    moduleId: mongoose.trusted({ $in: ordered.map((m) => m._id) }),
  }).lean();
  const lessonsByModule = new Map();
  for (const lesson of lessons) {
    const key = String(lesson.moduleId);
    lessonsByModule.set(key, [...(lessonsByModule.get(key) ?? []), lesson]);
  }
  const assessmentByModule = new Map(assessments.map((a) => [String(a.moduleId), a]));

  return {
    modules: ordered.map((m) => {
      const lessonOrder = new Map(m.lessonIds.map((id, i) => [String(id), i]));
      const moduleLessons = (lessonsByModule.get(String(m._id)) ?? []).sort(
        (a, b) => (lessonOrder.get(String(a._id)) ?? 0) - (lessonOrder.get(String(b._id)) ?? 0)
      );
      return {
        ...m,
        lessons: moduleLessons,
        assessment: assessmentByModule.get(String(m._id)) ?? null,
      };
    }),
  };
}

export async function updateCourse(ctx, actor, id, patch, meta) {
  const course = await loadCourse(id);
  assertCanEdit(actor, course);

  const changed = Object.keys(patch);
  if (patch.coverImage !== undefined) {
    course.coverImage = await resolveCoverImage(course._id, patch.coverImage);
  }
  for (const key of [
    'title',
    'summary',
    'description',
    'category',
    'targetRoles',
    'isRequired',
    'estimatedMinutes',
  ]) {
    if (patch[key] !== undefined) course[key] = patch[key];
  }
  course.updatedBy = oid(actor.id);
  await course.save();

  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'course.update',
    targetType: 'course',
    targetId: course._id,
    meta: { fields: changed },
    ip: meta.ip,
  });
  return courseSummary(course);
}

/** Load everything the checklist needs, as plain objects. */
async function loadForChecklist(course) {
  const tree = await loadTree(course);
  return {
    course: {
      title: course.title,
      summary: course.summary,
      coverImage: course.coverImage,
      targetRoles: course.targetRoles,
    },
    modules: tree.modules.map((m) => ({
      title: m.title,
      lessons: m.lessons,
      assessment: m.assessment
        ? {
            ...m.assessment,
            questions: m.assessment.questions.map((q) => ({ ...q, _id: String(q._id) })),
          }
        : null,
    })),
  };
}

export async function publishCourse(ctx, actor, id, meta) {
  const course = await loadCourse(id);
  assertCanEdit(actor, course);
  const problems = publishProblems(await loadForChecklist(course));
  if (problems.length > 0) {
    throw new HttpError(
      422,
      ERROR_CODES.PUBLISH_CHECKLIST_FAILED,
      `This course is not ready to publish. Fix ${problems.length} thing(s) and try again.`,
      problems
    );
  }
  course.status = COURSE_STATUS.PUBLISHED;
  course.publishedAt = ctx.now();
  course.updatedBy = oid(actor.id);
  await course.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'course.publish',
    targetType: 'course',
    targetId: course._id,
    ip: meta.ip,
  });
  return courseSummary(course);
}

async function setStatusBy(ctx, actor, id, status, action, meta) {
  const course = await loadCourse(id);
  course.status = status;
  course.updatedBy = oid(actor.id);
  await course.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action,
    targetType: 'course',
    targetId: course._id,
    ip: meta.ip,
  });
  return courseSummary(course);
}

export function unpublishCourse(ctx, actor, id, meta) {
  return setStatusBy(ctx, actor, id, COURSE_STATUS.DRAFT, 'course.unpublish', meta);
}

export function archiveCourse(ctx, actor, id, meta) {
  return setStatusBy(ctx, actor, id, COURSE_STATUS.ARCHIVED, 'course.archive', meta);
}

/**
 * Delete a course and everything under it. Refused once anyone has enrolled: archive it instead, so
 * their progress and certificates keep a course to point at (SPEC §6).
 */
export async function deleteCourse(ctx, actor, id, meta) {
  const course = await loadCourse(id);
  const enrolled = await Enrollment.exists({ courseId: course._id });
  if (enrolled) {
    throw new HttpError(
      409,
      ERROR_CODES.COURSE_HAS_ENROLMENTS,
      'Learners have enrolled in this course, so it cannot be deleted. Archive it instead.'
    );
  }
  const modules = await Module.find({ courseId: course._id }, { _id: 1 }).lean();
  const moduleIds = modules.map((m) => m._id);
  await Lesson.deleteMany({ moduleId: mongoose.trusted({ $in: moduleIds }) });
  await Assessment.deleteMany({ moduleId: mongoose.trusted({ $in: moduleIds }) });
  await Module.deleteMany({ courseId: course._id });
  await Upload.deleteMany({ courseId: course._id });
  await Course.deleteOne({ _id: course._id });
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'course.delete',
    targetType: 'course',
    targetId: course._id,
    meta: { modules: moduleIds.length },
    ip: meta.ip,
  });
}

/**
 * Learner view of the whole course, with no lock state (SPEC §6 preview). Uses the same serializers as
 * the learner app, so what an admin previews is what a learner gets.
 */
export async function previewCourse(ctx, actor, id) {
  const course = await loadCourse(id);
  if (!visibleTo(actor, course)) throw notFound('course');
  const settings = await getSettings();
  const tree = await loadTree(course);
  return {
    id: String(course._id),
    title: course.title,
    summary: course.summary,
    modules: tree.modules.map((m) => ({
      id: String(m._id),
      title: m.title,
      lessons: m.lessons.map((l) => serializeLessonForLearner(l)),
      assessment: m.assessment
        ? {
            id: String(m.assessment._id),
            title: m.assessment.title,
            questionCount: m.assessment.questions.length,
            passMark: m.assessment.passMark ?? settings.defaultPassMark ?? DEFAULT_PASS_MARK,
            questions: m.assessment.questions.map((q) =>
              serializeQuestionForLearner(q, presentationFor(q, { shuffleOptions: true }))
            ),
          }
        : null,
    })),
  };
}

/* ------------------------------------------------------------------ ordering */

/**
 * A reorder must list every id exactly once. Anything else is refused, so the stored order can never
 * drop an item or invent one.
 */
export function assertPermutation(current, requested) {
  const have = current.map(String).sort();
  const want = requested.map(String).sort();
  const same = have.length === want.length && have.every((id, i) => id === want[i]);
  if (!same || new Set(requested.map(String)).size !== requested.length) {
    throw new HttpError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      'The new order must list every item exactly once.',
      [{ path: 'order', message: 'List every item once, with no extras.' }]
    );
  }
}

/* ------------------------------------------------------------------ modules */

export async function createModule(ctx, actor, courseId, input, meta) {
  const course = await loadCourse(courseId);
  assertCanEdit(actor, course);
  const mod = await Module.create({
    courseId: course._id,
    title: input.title,
    description: input.description,
    order: course.moduleIds.length,
    lessonIds: [],
  });
  const assessment = await Assessment.create({
    moduleId: mod._id,
    title: `${input.title} check`,
    questions: [],
  });
  mod.assessmentId = assessment._id;
  await mod.save();
  course.moduleIds.push(mod._id);
  course.updatedBy = oid(actor.id);
  await course.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'module.create',
    targetType: 'module',
    targetId: mod._id,
    ip: meta.ip,
  });
  return {
    id: String(mod._id),
    title: mod.title,
    order: mod.order,
    assessmentId: String(assessment._id),
  };
}

export async function updateModule(ctx, actor, moduleId, patch, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  if (patch.title !== undefined) mod.title = patch.title;
  if (patch.description !== undefined) mod.description = patch.description;
  await mod.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'module.update',
    targetType: 'module',
    targetId: mod._id,
    ip: meta.ip,
  });
  return {
    id: String(mod._id),
    title: mod.title,
    description: mod.description ?? null,
    order: mod.order,
  };
}

export async function deleteModule(ctx, actor, moduleId, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  await Lesson.deleteMany({ moduleId: mod._id });
  await Assessment.deleteMany({ moduleId: mod._id });
  await Module.deleteOne({ _id: mod._id });
  course.moduleIds = course.moduleIds.filter((id) => String(id) !== String(mod._id));
  await course.save();
  await renumber(Module, course.moduleIds);
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'module.delete',
    targetType: 'module',
    targetId: mod._id,
    ip: meta.ip,
  });
}

export async function reorderModules(ctx, actor, courseId, moduleIds, meta) {
  const course = await loadCourse(courseId);
  assertCanEdit(actor, course);
  assertPermutation(course.moduleIds, moduleIds);
  course.moduleIds = moduleIds.map((id) => oid(id));
  course.updatedBy = oid(actor.id);
  await course.save();
  await renumber(Module, course.moduleIds);
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'content.reorder',
    targetType: 'course',
    targetId: course._id,
    meta: { what: 'modules' },
    ip: meta.ip,
  });
  return { moduleIds: course.moduleIds.map(String) };
}

/** Keep each item's `order` field equal to its index in the parent's id list. */
async function renumber(model, ids) {
  if (ids.length === 0) return;
  await model.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
    }))
  );
}

/* ------------------------------------------------------------------ lessons */

/** Check document and video fields and build the stored lesson. Thumbnails are derived, never trusted. */
async function buildLessonFields(courseId, type, input, existing) {
  const fields = {};
  if (input.title !== undefined) fields.title = input.title;
  fields.xp =
    type === LESSON_TYPES.VIDEO
      ? XP.VIDEO_LESSON_COMPLETED
      : type === LESSON_TYPES.TEXT
        ? XP.TEXT_LESSON_COMPLETED
        : type === LESSON_TYPES.DOCUMENT
          ? XP.DOCUMENT_LESSON_COMPLETED
          : XP.PRACTICE_LESSON_COMPLETED;

  if (type === LESSON_TYPES.VIDEO && input.video) {
    const video = input.video;
    fields.video = {
      youtubeId: video.youtubeId,
      title: existing?.video?.title ?? video.title ?? 'Video',
      thumbnailUrl: `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      durationSec: video.durationSec ?? existing?.video?.durationSec ?? null,
      keyPoints: video.keyPoints ?? [],
    };
  }

  if (type === LESSON_TYPES.TEXT && input.text) {
    const check = validateRichText(input.text.doc);
    if (!check.valid) {
      throw new HttpError(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        'The text contains something that is not allowed.',
        [{ path: 'text.doc', message: check.errors[0] }]
      );
    }
    fields.text = { doc: input.text.doc, readMinutes: input.text.readMinutes };
  }

  if (type === LESSON_TYPES.DOCUMENT && input.document) {
    const upload = await Upload.findOne({
      publicId: input.document.publicId,
      courseId: oid(courseId),
      kind: 'pdf',
      confirmedAt: mongoose.trusted({ $ne: null }),
    }).lean();
    if (!upload) {
      throw new HttpError(400, ERROR_CODES.VALIDATION_FAILED, 'Upload the PDF first.', [
        {
          path: 'document',
          message: 'Upload the PDF with the upload button, then save the lesson.',
        },
      ]);
    }
    // Size and page count come from the confirmed upload, not from the request.
    fields.document = {
      url: upload.url,
      publicId: upload.publicId,
      fileName: input.document.fileName,
      bytes: upload.bytes,
      pages: upload.pages ?? null,
    };
  }

  if (type === LESSON_TYPES.PRACTICE && input.practice) {
    const existingById = new Map(
      (existing?.practice?.questions ?? []).map((q) => [String(q._id), q])
    );
    const questions = [];
    for (const q of input.practice.questions) {
      const stored = q._id ? existingById.get(String(q._id)) : undefined;
      const withIds = assignQuestionIds(q, stored);
      questions.push(versionedQuestion(withIds, stored));
    }
    fields.practice = { questions };
  }

  return fields;
}

export async function createLesson(ctx, actor, moduleId, input, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  const fields = await buildLessonFields(course._id, input.type, input, null);
  const lesson = await Lesson.create({
    ...fields,
    moduleId: mod._id,
    type: input.type,
    title: input.title,
    order: mod.lessonIds.length,
  });
  mod.lessonIds.push(lesson._id);
  await mod.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'lesson.create',
    targetType: 'lesson',
    targetId: lesson._id,
    meta: { type: input.type },
    ip: meta.ip,
  });
  return { id: String(lesson._id), title: lesson.title, type: lesson.type, order: lesson.order };
}

/** Full lesson for the editor, including answer keys (admin only). */
export async function getLesson(ctx, actor, moduleId, lessonId) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  if (!visibleTo(actor, course)) throw notFound('lesson');
  const lesson = await Lesson.findOne({ _id: oid(lessonId), moduleId: mod._id }).lean();
  if (!lesson) throw notFound('lesson');
  return {
    id: String(lesson._id),
    title: lesson.title,
    type: lesson.type,
    order: lesson.order,
    xp: lesson.xp,
    video: lesson.video ?? null,
    text: lesson.text ?? null,
    document: lesson.document ?? null,
    practice: lesson.practice
      ? {
          questions: lesson.practice.questions.map((q) => ({
            ...JSON.parse(JSON.stringify(q)),
            id: String(q._id),
          })),
        }
      : null,
  };
}

export async function updateLesson(ctx, actor, moduleId, lessonId, patch, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  const lesson = await Lesson.findOne({ _id: oid(lessonId), moduleId: mod._id });
  if (!lesson) throw notFound('lesson');
  const fields = await buildLessonFields(course._id, lesson.type, patch, lesson.toObject());
  Object.assign(lesson, fields);
  await lesson.save();
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'lesson.update',
    targetType: 'lesson',
    targetId: lesson._id,
    meta: { fields: Object.keys(patch) },
    ip: meta.ip,
  });
  return { id: String(lesson._id), title: lesson.title, type: lesson.type, order: lesson.order };
}

export async function deleteLesson(ctx, actor, moduleId, lessonId, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  const lesson = await Lesson.findOne({ _id: oid(lessonId), moduleId: mod._id });
  if (!lesson) throw notFound('lesson');
  await Lesson.deleteOne({ _id: lesson._id });
  mod.lessonIds = mod.lessonIds.filter((id) => String(id) !== String(lesson._id));
  await mod.save();
  await renumber(Lesson, mod.lessonIds);
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'lesson.delete',
    targetType: 'lesson',
    targetId: lesson._id,
    ip: meta.ip,
  });
}

export async function reorderLessons(ctx, actor, moduleId, lessonIds, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  assertPermutation(mod.lessonIds, lessonIds);
  mod.lessonIds = lessonIds.map((id) => oid(id));
  await mod.save();
  await renumber(Lesson, mod.lessonIds);
  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'content.reorder',
    targetType: 'module',
    targetId: mod._id,
    meta: { what: 'lessons' },
    ip: meta.ip,
  });
  return { lessonIds: mod.lessonIds.map(String) };
}

/* ------------------------------------------------------------------ assessments */

/** JSON with object keys sorted at every depth, so equal content always gives equal text. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * What a learner would see and what counts as the answer, written in words rather than ids. Item ids
 * are regenerated on every save (SECURITY §3), so comparing ids would bump the version on every edit.
 */
function contentOf(question) {
  const textOf = new Map(
    [...(question.options ?? []), ...(question.items ?? [])].map((i) => [i.id, i.text])
  );
  const leftOf = new Map((question.pairs ?? []).map((p) => [p.id, p.left]));
  const rightOf = new Map((question.pairs ?? []).map((p) => [p.rightId, p.right]));
  return stableStringify({
    type: question.type,
    prompt: question.prompt,
    imageUrl: question.imageUrl ?? null,
    explanation: question.explanation ?? null,
    points: question.points,
    options: question.options?.map((o) => o.text),
    correct: question.correct,
    correctText: textOf.get(question.correctOptionId) ?? null,
    correctTexts: question.correctOptionIds?.map((id) => textOf.get(id)),
    items: question.items?.map((i) => i.text),
    correctOrder: question.correctOrder?.map((id) => textOf.get(id)),
    pairs: question.pairs?.map((p) => [leftOf.get(p.id), rightOf.get(p.rightId)]),
    template: question.template ?? null,
    acceptedAnswers: question.acceptedAnswers ?? null,
  });
}

/**
 * Stamp the version on a question: unchanged content keeps its version, changed content increments it,
 * and a new question starts at 1. Attempts keep the version they started with (SPEC §8.2).
 */
function versionedQuestion(next, stored) {
  if (!stored) return { ...next, version: 1 };
  const storedPlain = JSON.parse(JSON.stringify(stored));
  const changed = contentOf(storedPlain) !== contentOf(next);
  return { ...next, version: changed ? (stored.version ?? 1) + 1 : (stored.version ?? 1) };
}

export async function getAssessment(ctx, actor, moduleId) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  if (!visibleTo(actor, course)) throw notFound('module');
  const assessment = await Assessment.findById(mod.assessmentId).lean();
  if (!assessment) throw notFound('assessment');
  return assessmentView(assessment);
}

function assessmentView(a) {
  return {
    id: String(a._id),
    moduleId: String(a.moduleId),
    title: a.title,
    drawCount: a.drawCount ?? null,
    passMark: a.passMark ?? null,
    maxAttempts: a.maxAttempts ?? null,
    shuffleQuestions: a.shuffleQuestions,
    shuffleOptions: a.shuffleOptions,
    revealAnswers: a.revealAnswers,
    timeLimitMin: a.timeLimitMin ?? null,
    questions: a.questions.map((q) => ({ ...JSON.parse(JSON.stringify(q)), id: String(q._id) })),
  };
}

export async function putAssessment(ctx, actor, moduleId, body, meta) {
  const { mod, course } = await loadModuleAndCourse(moduleId);
  assertCanEdit(actor, course);
  const assessment = await Assessment.findById(mod.assessmentId);
  if (!assessment) throw notFound('assessment');

  const storedById = new Map(assessment.questions.map((q) => [String(q._id), q]));
  const questions = body.questions.map((input) => {
    const stored = input._id ? storedById.get(String(input._id)) : undefined;
    if (input._id && !stored) {
      throw new HttpError(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        'A question no longer exists in this bank.',
        [{ path: 'questions', message: 'Reload the bank and try again.' }]
      );
    }
    const storedPlain = stored ? stored.toObject() : undefined;
    const withIds = assignQuestionIds(input, storedPlain);
    const stamped = versionedQuestion(withIds, storedPlain);
    // Keep the stored _id so attempts that reference the question still match.
    return { ...stamped, _id: stored ? stored._id : new mongoose.Types.ObjectId() };
  });

  // Re-validate the whole bank as stored data, so no unchecked shape reaches the database.
  for (const q of questions) {
    const check = questionSchema.safeParse({ ...q, _id: String(q._id) });
    if (!check.success) {
      throw new HttpError(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        'A question has an invalid answer key.',
        [{ path: 'questions', message: check.error.issues[0].message }]
      );
    }
  }

  for (const key of [
    'title',
    'drawCount',
    'passMark',
    'maxAttempts',
    'shuffleQuestions',
    'shuffleOptions',
    'revealAnswers',
    'timeLimitMin',
  ]) {
    if (body[key] !== undefined) assessment[key] = body[key];
  }
  assessment.questions = questions;
  await assessment.save();

  await recordAudit(ctx, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'assessment.update',
    targetType: 'assessment',
    targetId: assessment._id,
    meta: { questions: questions.length },
    ip: meta.ip,
  });
  return assessmentView(assessment.toObject());
}

export { loadCourse, loadModuleAndCourse, loadTree, visibleTo, assertCanEdit };
