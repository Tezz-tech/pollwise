import { Router } from 'express';
import { ROLES } from '@pollwise/shared/constants';
import { createContentController } from '../controllers/content.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  assessmentBody,
  courseCreateBody,
  courseListQuery,
  courseUpdateBody,
  idAndModuleParams,
  idParams,
  lessonBody,
  lessonUpdateBody,
  moduleCreateBody,
  moduleUpdateBody,
  moduleAndLessonParams,
  reorderBody,
  uploadConfirmBody,
  uploadSignBody,
  youtubeLookupQuery,
} from '../validation/content.schemas.js';

const CONTENT = [ROLES.CONTENT_ADMIN, ROLES.SUPER_ADMIN];
const SUPER = [ROLES.SUPER_ADMIN];

/**
 * Content routes (SPEC §6 admin). Mounted inside the admin router, which has already checked the
 * session and rate limit. Each route still states its role; ownership is checked in the services.
 * @param {object} ctx
 */
export function createContentRoutes(ctx) {
  const c = createContentController(ctx);
  const router = Router();

  // Courses
  router.get(
    '/courses',
    requireRole(...CONTENT),
    validate({ query: courseListQuery }),
    c.listCourses
  );
  router.post(
    '/courses',
    requireRole(...CONTENT),
    validate({ body: courseCreateBody }),
    c.createCourse
  );
  router.get('/courses/:id', requireRole(...CONTENT), validate({ params: idParams }), c.getCourse);
  router.patch(
    '/courses/:id',
    requireRole(...CONTENT),
    validate({ params: idParams, body: courseUpdateBody }),
    c.updateCourse
  );
  router.get(
    '/courses/:id/preview',
    requireRole(...CONTENT),
    validate({ params: idParams }),
    c.previewCourse
  );
  router.post(
    '/courses/:id/publish',
    requireRole(...CONTENT),
    validate({ params: idParams }),
    c.publishCourse
  );
  router.post(
    '/courses/:id/unpublish',
    requireRole(...SUPER),
    validate({ params: idParams }),
    c.unpublishCourse
  );
  router.post(
    '/courses/:id/archive',
    requireRole(...SUPER),
    validate({ params: idParams }),
    c.archiveCourse
  );
  router.delete(
    '/courses/:id',
    requireRole(...SUPER),
    validate({ params: idParams }),
    c.deleteCourse
  );

  // Modules
  router.post(
    '/courses/:id/modules',
    requireRole(...CONTENT),
    validate({ params: idParams, body: moduleCreateBody }),
    c.createModule
  );
  router.put(
    '/courses/:id/modules/order',
    requireRole(...CONTENT),
    validate({ params: idParams, body: reorderBody('moduleIds') }),
    c.reorderModules
  );
  router.patch(
    '/courses/:id/modules/:moduleId',
    requireRole(...CONTENT),
    validate({ params: idAndModuleParams, body: moduleUpdateBody }),
    c.updateModule
  );
  router.delete(
    '/courses/:id/modules/:moduleId',
    requireRole(...CONTENT),
    validate({ params: idAndModuleParams }),
    c.deleteModule
  );

  // Lessons
  router.post(
    '/modules/:id/lessons',
    requireRole(...CONTENT),
    validate({ params: idParams, body: lessonBody }),
    c.createLesson
  );
  router.put(
    '/modules/:id/lessons/order',
    requireRole(...CONTENT),
    validate({ params: idParams, body: reorderBody('lessonIds') }),
    c.reorderLessons
  );
  router.patch(
    '/modules/:id/lessons/:lessonId',
    requireRole(...CONTENT),
    validate({ params: moduleAndLessonParams, body: lessonUpdateBody }),
    c.updateLesson
  );
  router.delete(
    '/modules/:id/lessons/:lessonId',
    requireRole(...CONTENT),
    validate({ params: moduleAndLessonParams }),
    c.deleteLesson
  );

  // Assessments and their banks
  router.get(
    '/modules/:id/assessment',
    requireRole(...CONTENT),
    validate({ params: idParams }),
    c.getAssessment
  );
  router.put(
    '/modules/:id/assessment',
    requireRole(...CONTENT),
    validate({ params: idParams, body: assessmentBody }),
    c.putAssessment
  );

  // Uploads and YouTube
  router.post(
    '/uploads/sign',
    requireRole(...CONTENT),
    validate({ body: uploadSignBody }),
    c.signUpload
  );
  router.post(
    '/uploads/confirm',
    requireRole(...CONTENT),
    validate({ body: uploadConfirmBody }),
    c.confirmUpload
  );
  router.get(
    '/youtube/lookup',
    requireRole(...CONTENT),
    validate({ query: youtubeLookupQuery }),
    c.youtubeLookup
  );

  return router;
}
