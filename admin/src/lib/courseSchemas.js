/**
 * Client-side validation for the course and lesson forms. The server re-validates everything; these
 * rules exist so the admin sees a message next to the field before a request is sent (DESIGN §7).
 */
import { z } from 'zod';
import { PERSONNEL_ROLE_LABELS } from './labels.js';

export const courseCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give the course a title of at least 3 characters.')
    .max(120, 'Keep the title under 120 characters.'),
  summary: z
    .string()
    .trim()
    .min(10, 'Write a short summary of at least 10 characters.')
    .max(160, 'Keep the summary under 160 characters.'),
  category: z
    .string()
    .trim()
    .max(60, 'Keep the category under 60 characters.')
    .optional()
    .default(''),
  targetRoles: z
    .array(z.enum(Object.keys(PERSONNEL_ROLE_LABELS)))
    .min(1, 'Choose at least one role this course is for.'),
  isRequired: z.boolean().optional().default(false),
  estimatedMinutes: z.number().int().min(0).optional().default(0),
});

export const moduleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Give the module a title of at least 2 characters.')
    .max(160, 'Keep the title under 160 characters.'),
  description: z.string().trim().max(500).optional().default(''),
});

export const textLessonSchema = z.object({
  title: z.string().trim().min(2, 'Give the lesson a title.').max(160),
});

/** Count of "___" blanks in a template (the server uses the same rule). */
export function blankCount(template) {
  return template.split('___').length - 1;
}
