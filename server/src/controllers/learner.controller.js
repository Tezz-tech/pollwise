/**
 * Learner controllers. Each mutating response carries the `events` array the app celebrates (SPEC §8.8).
 * The services do all the rules; these only shape responses.
 */
import * as catalogue from '../services/catalogueService.js';
import * as lessons from '../services/lessonService.js';
import * as attempts from '../services/attemptService.js';
import * as certificates from '../services/certificateService.js';
import * as stats from '../services/statsService.js';

const userOf = (req) => req.user.id;

export function createLearnerController(ctx) {
  return {
    async catalogue(req, res) {
      res.json({ data: await catalogue.listCatalogue(ctx, userOf(req), req.validated.query) });
    },

    async outline(req, res) {
      res.json({ data: await catalogue.getOutline(ctx, userOf(req), req.validated.params.slug) });
    },

    async enrol(req, res) {
      const result = await catalogue.enrol(ctx, userOf(req), req.validated.params.id);
      res.json({ data: result });
    },

    async getLesson(req, res) {
      res.json({ data: await lessons.getLesson(ctx, userOf(req), req.validated.params.id) });
    },

    async heartbeat(req, res) {
      const result = await lessons.heartbeat(
        ctx,
        userOf(req),
        req.validated.params.id,
        req.validated.body
      );
      res.json({ data: { ...result, events: result.events } });
    },

    async complete(req, res) {
      const result = await lessons.complete(ctx, userOf(req), req.validated.params.id);
      res.json({ data: result });
    },

    async practiceAnswer(req, res) {
      const result = await lessons.answerPractice(
        ctx,
        userOf(req),
        req.validated.params.id,
        req.validated.body
      );
      res.json({ data: result });
    },

    async startAttempt(req, res) {
      const result = await attempts.startAttempt(ctx, userOf(req), req.validated.params.id);
      res.status(201).json({ data: result });
    },

    async getAttempt(req, res) {
      res.json({ data: await attempts.getAttempt(ctx, userOf(req), req.validated.params.id) });
    },

    async answer(req, res) {
      const result = await attempts.answerQuestion(
        ctx,
        userOf(req),
        req.validated.params.id,
        req.validated.body
      );
      res.json({ data: result });
    },

    async submit(req, res) {
      res.json({ data: await attempts.submitAttempt(ctx, userOf(req), req.validated.params.id) });
    },

    async myCertificates(req, res) {
      res.json({ data: await certificates.listMine(userOf(req)) });
    },

    async certificatePdfLink(req, res) {
      res.json({ data: await certificates.certificatePdfLink(ctx, userOf(req), req.validated.params.id) });
    },

    async certificatePdf(req, res) {
      const pdf = await certificates.certificatePdf(ctx, userOf(req), req.validated.params.id);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'attachment; filename="pollwise-certificate.pdf"');
      res.send(pdf);
    },

    async verify(req, res) {
      res.json({ data: await certificates.verify(req.validated.params.code) });
    },

    async myStats(req, res) {
      res.json({ data: await stats.getStats(ctx, userOf(req)) });
    },
  };
}
