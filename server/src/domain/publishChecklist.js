/**
 * Publish checklist (SPEC §8.5). Pure: takes a course tree, returns every problem at once so the admin
 * can fix them in one pass (SPEC §8.5 "return every failure at once").
 */
import { QUESTION_TYPES } from '@pollwise/shared/constants';
import { questionSchema } from '@pollwise/shared/schemas';

/**
 * @param {{
 *   course: { title?: string, summary?: string, coverImage?: { url?: string }, targetRoles?: string[] },
 *   modules: Array<{
 *     title: string,
 *     lessons: Array<{ type: string, video?: { youtubeId?: string, durationSec?: number },
 *                      text?: object, document?: { url?: string }, title: string }>,
 *     assessment?: { drawCount?: number | null, questions: object[] } | null,
 *   }>,
 * }} tree lean documents, lessons and assessments already loaded in order
 * @returns {Array<{ path: string, message: string }>} empty when the course may be published
 */
export function publishProblems(tree) {
  const problems = [];
  const add = (path, message) => problems.push({ path, message });

  const { course, modules } = tree;
  if (!course.title?.trim()) add('title', 'Give the course a title.');
  if (!course.summary?.trim()) add('summary', 'Write a short summary.');
  if (!course.coverImage?.url) add('coverImage', 'Add a cover image.');
  if (!course.targetRoles?.length)
    add('targetRoles', 'Choose at least one role this course is for.');
  if (modules.length === 0) add('modules', 'Add at least one module.');

  modules.forEach((mod, mi) => {
    const at = `modules[${mi}]`;
    if (mod.lessons.length === 0) add(`${at}.lessons`, `"${mod.title}" needs at least one lesson.`);

    mod.lessons.forEach((lesson, li) => {
      const lessonAt = `${at}.lessons[${li}]`;
      if (lesson.type === 'video') {
        if (!lesson.video?.youtubeId)
          add(`${lessonAt}.video`, `"${lesson.title}" needs a YouTube video.`);
        if (!lesson.video?.durationSec) {
          add(
            `${lessonAt}.video`,
            `"${lesson.title}": open the video once so its length is saved.`
          );
        }
      }
      if (lesson.type === 'document' && !lesson.document?.url) {
        add(`${lessonAt}.document`, `"${lesson.title}" needs a PDF.`);
      }
      if (lesson.type === 'text' && !lesson.text?.doc) {
        add(`${lessonAt}.text`, `"${lesson.title}" needs content.`);
      }
    });

    const assessment = mod.assessment;
    if (!assessment) {
      add(`${at}.assessment`, `"${mod.title}" needs an assessment.`);
      return;
    }
    const gradable = assessment.questions.filter((q) => q.type !== QUESTION_TYPES.REFLECTION);
    const needed = assessment.drawCount ?? 1;
    if (gradable.length < needed) {
      add(
        `${at}.assessment`,
        `"${mod.title}" has ${gradable.length} gradable question(s) but draws ${needed}.`
      );
    }
    assessment.questions.forEach((q, qi) => {
      if (q.type === QUESTION_TYPES.REFLECTION) return;
      const result = questionSchema.safeParse(q);
      if (!result.success) {
        add(`${at}.assessment.questions[${qi}]`, 'This question has an invalid answer key.');
      }
    });
  });

  return problems;
}
