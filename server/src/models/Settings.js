/**
 * Platform settings, a single document (SPEC §5 "Settings"). The `key` field pins it to one row.
 */
import mongoose from 'mongoose';
import { DEFAULT_PASS_MARK, REGISTRATION_MODES } from '@pollwise/shared/constants';

const { Schema } = mongoose;

export const SETTINGS_KEY = 'singleton';

export const settingsSchema = new Schema(
  {
    key: { type: String, default: SETTINGS_KEY, unique: true },
    defaultPassMark: { type: Number, default: DEFAULT_PASS_MARK, min: 1, max: 100 },
    registrationMode: {
      type: String,
      enum: Object.values(REGISTRATION_MODES),
      default: REGISTRATION_MODES.OPEN,
    },
    accessCodes: {
      type: [
        {
          codeHash: { type: String, required: true },
          label: { type: String, maxlength: 80 },
          active: { type: Boolean, default: true },
          uses: { type: Number, default: 0 },
        },
      ],
      select: false,
      default: [],
    },
    nextElectionDate: Date,
    nextElectionLabel: { type: String, maxlength: 120 },
    supportEmail: String,
    privacyPolicyUrl: String,
    aboutText: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
