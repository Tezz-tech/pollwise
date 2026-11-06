import { Router } from 'express';
import { createLearnerController } from '../controllers/learner.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { certificateAuth } from '../middleware/certificateAuth.js';
import { validate } from '../middleware/validate.js';
import {
  attemptAnswerBody,
  attemptParams,
  catalogueQuery,
  certificateCodeParams,
  certificatePdfQuery,
  heartbeatBody,
  idParams,
  lessonParams,
  practiceAnswerBody,
  slugParams,
} from '../validation/learner.schemas.js';

/**
 * Learner routes (SPEC §6). Authentication and the per-user limit are attached to each route rather than
 * to the whole router, so mounting order can never put a public route behind a login check.
 * @param {object} ctx
 * @param {ReturnType<typeof import('../middleware/rateLimit.js').createRateLimiters>} limiters
 */
export function createLearnerRouter(ctx, limiters) {
  const c = createLearnerController(ctx);
  const router = Router();
  const auth = [requireAuth(ctx), limiters.authed];

  router.get('/courses', ...auth, validate({ query: catalogueQuery }), c.catalogue);
  router.get('/courses/:slug', ...auth, validate({ params: slugParams }), c.outline);
  router.post('/courses/:id/enroll', ...auth, validate({ params: idParams }), c.enrol);

  router.get('/lessons/:id', ...auth, validate({ params: lessonParams }), c.getLesson);
  router.post(
    '/lessons/:id/heartbeat',
    requireAuth(ctx),
    limiters.heartbeat,
    validate({ params: lessonParams, body: heartbeatBody }),
    c.heartbeat
  );
  router.post('/lessons/:id/complete', ...auth, validate({ params: lessonParams }), c.complete);
  router.post(
    '/lessons/:id/practice/answer',
    ...auth,
    validate({ params: lessonParams, body: practiceAnswerBody }),
    c.practiceAnswer
  );

  router.post('/assessments/:id/attempts', ...auth, validate({ params: idParams }), c.startAttempt);
  router.get('/attempts/:id', ...auth, validate({ params: attemptParams }), c.getAttempt);
  router.post(
    '/attempts/:id/answers',
    requireAuth(ctx),
    limiters.answers,
    validate({ params: attemptParams, body: attemptAnswerBody }),
    c.answer
  );
  router.post('/attempts/:id/submit', ...auth, validate({ params: attemptParams }), c.submit);

  router.get(
    '/certificates/:id/pdf-link',
    ...auth,
    validate({ params: idParams }),
    c.certificatePdfLink
  );
  router.get(
    '/certificates/:id/pdf',
    certificateAuth(ctx),
    limiters.authed,
    validate({ params: idParams, query: certificatePdfQuery }),
    c.certificatePdf
  );
  return router;
}

/**
 * Public verification (SPEC §8.6). No sign-in; limited per IP (SECURITY §5).
 */
export function createVerifyRouter(ctx, limiters) {
  const c = createLearnerController(ctx);
  const router = Router();
  router.get(
    '/verify/:code',
    limiters.verify,
    validate({ params: certificateCodeParams }),
    c.verify
  );
  return router;
}
