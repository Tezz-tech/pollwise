/**
 * Small validators reused across the shared schemas.
 */
import { z } from 'zod';

/** A Mongo ObjectId as a 24-character hex string (SECURITY §4: validate before Mongoose sees it). */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

/** YouTube video IDs are exactly 11 characters from this set (SPEC §7). */
export const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'Invalid YouTube id');

/** Short, stable identifiers for options, pairs and items inside a question. */
export const itemIdSchema = z.string().min(1).max(64);

/** Human text with a sane upper bound; trimmed so "  " is rejected as empty. */
export const shortText = (max) => z.string().trim().min(1).max(max);

/** Non-negative whole number of seconds or XP, capped to keep bad input out. */
export const wholeNumber = (max) => z.number().int().min(0).max(max);

/** An https URL. Plain http and other schemes are refused (SECURITY §6). */
export const httpsUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be an https URL');
