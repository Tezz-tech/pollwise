/**
 * Super admin controllers. Thin: services do the rules and the audit writes.
 */
import * as people from '../services/adminPeopleService.js';
import * as settings from '../services/adminSettingsService.js';
import * as reports from '../services/reportService.js';
import { recordAudit } from '../services/auditService.js';

const actorOf = (req) => ({ id: req.user.id, role: req.user.role });
const metaOf = (req) => ({ ip: req.ip });

export function createSuperController(ctx) {
  return {
    async listUsers(req, res) {
      const { page, limit, ...filters } = req.validated.query;
      res.json({ data: await people.listUsers(filters, { page, limit }) });
    },

    async exportUsers(req, res) {
      const filters = req.validated.query;
      // Audit first: if the export is attempted, it is recorded, even if the client disconnects midway.
      await recordAudit(ctx, {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'users.export',
        targetType: 'users',
        meta: { filters: { ...filters } },
        ip: req.ip,
      });
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="pollwise-learners.csv"');
      res.set('Cache-Control', 'no-store');
      res.write(`${people.CSV_COLUMNS.join(',')}\n`);
      const cursor = people.exportCursor(filters);
      try {
        for await (const row of cursor) {
          if (!res.write(`${people.csvLine(row)}\n`)) {
            await new Promise((resolve) => res.once('drain', resolve));
          }
        }
      } finally {
        await cursor.close().catch(() => {});
      }
      res.end();
    },

    async userDetail(req, res) {
      res.json({
        data: await people.userDetail(ctx, actorOf(req), req.validated.params.id, metaOf(req)),
      });
    },

    async setUserStatus(req, res) {
      res.json({
        data: await people.setUserStatus(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body.status,
          metaOf(req)
        ),
      });
    },

    async sendReset(req, res) {
      res.json({
        data: await people.sendUserReset(ctx, actorOf(req), req.validated.params.id, metaOf(req)),
      });
    },

    async grantAttempt(req, res) {
      res.json({
        data: await people.grantAttempt(
          ctx,
          actorOf(req),
          req.validated.params.id,
          req.validated.body.assessmentId,
          metaOf(req)
        ),
      });
    },

    async overview(_req, res) {
      res.json({ data: await reports.overview(ctx) });
    },

    async courseReport(_req, res) {
      res.json({ data: await reports.courseReport() });
    },

    async geographyReport(req, res) {
      res.json({ data: await reports.geographyReport(req.validated.query.stateCode) });
    },

    async listAdmins(_req, res) {
      res.json({ data: await people.listAdmins() });
    },

    async revokeAdmin(req, res) {
      res.json({
        data: await people.revokeAdmin(ctx, actorOf(req), req.validated.params.id, metaOf(req)),
      });
    },

    async getSettings(_req, res) {
      res.json({ data: await settings.getAdminSettings() });
    },

    async updateSettings(req, res) {
      res.json({
        data: await settings.updateSettings(ctx, actorOf(req), req.validated.body, metaOf(req)),
      });
    },

    async addAccessCode(req, res) {
      res.status(201).json({
        data: await settings.addAccessCode(ctx, actorOf(req), req.validated.body, metaOf(req)),
      });
    },

    async setAccessCode(req, res) {
      res.json({
        data: await settings.setAccessCodeActive(
          ctx,
          actorOf(req),
          req.validated.params.codeId,
          req.validated.body.active,
          metaOf(req)
        ),
      });
    },

    async auditLog(req, res) {
      const { page, limit, ...filters } = req.validated.query;
      res.json({ data: await settings.queryAuditLog(filters, { page, limit }) });
    },
  };
}
