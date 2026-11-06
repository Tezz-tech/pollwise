/**
 * Admin content controllers. Thin: validation has run, services do the work, and this file only shapes
 * the response. Every handler's audit and ownership rules live in the services.
 */
import * as content from '../services/contentService.js';
import * as uploads from '../services/uploadService.js';
import { extractYoutubeId, lookupYoutubeVideo } from '../domain/youtube.js';
import { ERROR_CODES } from '@pollwise/shared/constants';
import { HttpError } from '../utils/httpError.js';

/** @param {import('express').Request} req */
const actorOf = (req) => ({ id: req.user.id, role: req.user.role });
const metaOf = (req) => ({ ip: req.ip });

export function createContentController(ctx) {
  return {
    async listCourses(req, res) {
      res.json({ data: await content.listCourses(ctx, actorOf(req), req.validated.query) });
    },

    async createCourse(req, res) {
      res.status(201).json({
        data: await content.createCourse(ctx, actorOf(req), req.validated.body, metaOf(req)),
      });
    },

    async getCourse(req, res) {
      res.json({ data: await content.getCourseTree(ctx, actorOf(req), req.validated.params.id) });
    },

    async updateCourse(req, res) {
      res.json({
        data: await content.updateCourse(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body,
          metaOf(req)
        ),
      });
    },

    async publishCourse(req, res) {
      res.json({
        data: await content.publishCourse(ctx, actorOf(req), req.validated.params.id, metaOf(req)),
      });
    },

    async unpublishCourse(req, res) {
      res.json({
        data: await content.unpublishCourse(
          ctx,
          actorOf(req),
          req.validated.params.id,
          metaOf(req)
        ),
      });
    },

    async archiveCourse(req, res) {
      res.json({
        data: await content.archiveCourse(ctx, actorOf(req), req.validated.params.id, metaOf(req)),
      });
    },

    async deleteCourse(req, res) {
      await content.deleteCourse(ctx, actorOf(req), req.validated.params.id, metaOf(req));
      res.status(204).end();
    },

    async previewCourse(req, res) {
      res.json({ data: await content.previewCourse(ctx, actorOf(req), req.validated.params.id) });
    },

    async createModule(req, res) {
      res.status(201).json({
        data: await content.createModule(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body,
          metaOf(req)
        ),
      });
    },

    async updateModule(req, res) {
      res.json({
        data: await content.updateModule(
          ctx,
          actorOf(req),
          req.validated.params.moduleId,
          req.validated.body,
          metaOf(req)
        ),
      });
    },

    async deleteModule(req, res) {
      await content.deleteModule(ctx, actorOf(req), req.validated.params.moduleId, metaOf(req));
      res.status(204).end();
    },

    async reorderModules(req, res) {
      res.json({
        data: await content.reorderModules(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body.moduleIds,
          metaOf(req)
        ),
      });
    },

    async createLesson(req, res) {
      res.status(201).json({
        data: await content.createLesson(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body,
          metaOf(req)
        ),
      });
    },

    async updateLesson(req, res) {
      res.json({
        data: await content.updateLesson(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.params.lessonId,
          req.validated.body,
          metaOf(req)
        ),
      });
    },

    async deleteLesson(req, res) {
      await content.deleteLesson(
        ctx,
        actorOf(req),
        req.validated.params.id,
        req.validated.params.lessonId,
        metaOf(req)
      );
      res.status(204).end();
    },

    async reorderLessons(req, res) {
      res.json({
        data: await content.reorderLessons(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body.lessonIds,
          metaOf(req)
        ),
      });
    },

    async getAssessment(req, res) {
      res.json({ data: await content.getAssessment(ctx, actorOf(req), req.validated.params.id) });
    },

    async putAssessment(req, res) {
      res.json({
        data: await content.putAssessment(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body,
          metaOf(req)
        ),
      });
    },

    async signUpload(req, res) {
      res.json({
        data: await uploads.signUpload(ctx, actorOf(req), req.validated.body, metaOf(req)),
      });
    },

    async confirmUpload(req, res) {
      res.json({
        data: await uploads.confirmUpload(ctx, actorOf(req), req.validated.body, metaOf(req)),
      });
    },

    async youtubeLookup(req, res) {
      const youtubeId = extractYoutubeId(req.validated.query.url);
      if (!youtubeId) {
        throw new HttpError(
          400,
          ERROR_CODES.VALIDATION_FAILED,
          'That is not a YouTube video link.',
          [
            {
              path: 'url',
              message: 'Paste a link like https://www.youtube.com/watch?v=… or https://youtu.be/…',
            },
          ]
        );
      }
      res.json({ data: await lookupYoutubeVideo(ctx.fetch, youtubeId) });
    },
  };
}
