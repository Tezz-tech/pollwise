/**
 * Controllers for /me, /geo, /settings and /admin. Thin: see auth.controller.js for the pattern.
 */
import * as users from '../services/userService.js';
import * as geo from '../services/geoService.js';
import * as settings from '../services/settingsService.js';
import * as admins from '../services/adminService.js';

export function createAccountController(ctx) {
  return {
    async getMe(req, res) {
      res.json({ data: await users.getMe(ctx, req.user.id) });
    },

    async updateMe(req, res) {
      res.json({ data: await users.updateMe(ctx, req.user.id, req.validated.body) });
    },

    async updateProfile(req, res) {
      res.json({ data: await users.updateProfile(ctx, req.user.id, req.validated.body) });
    },

    async requestDeletion(req, res) {
      res.status(202).json({ data: await users.requestDeletion(ctx, req.user.id) });
    },

    async listStates(_req, res) {
      res.json({ data: await geo.listStates() });
    },

    async listLgas(req, res) {
      res.json({ data: await geo.listLgas(req.validated.params.stateCode) });
    },

    async publicSettings(_req, res) {
      res.json({ data: await settings.getPublicSettings() });
    },

    async adminSession(req, res) {
      res.json({ data: await users.getMe(ctx, req.user.id) });
    },

    async inviteAdmin(req, res) {
      const actor = { _id: req.user.id, role: req.user.role };
      const invited = await admins.inviteAdmin(ctx, actor, req.validated.body, { ip: req.ip });
      res.status(201).json({ data: invited });
    },
  };
}
