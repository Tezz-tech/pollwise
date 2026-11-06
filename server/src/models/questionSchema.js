/**
 * Embedded question subdocument (SPEC §5 "Question"), shared by lessons (practice) and assessments.
 *
 * One schema covers all seven types. Which fields are used depends on `type`; the zod schemas in
 * @pollwise/shared are the authority on validity, and they run before anything is saved. This schema
 * only stores. Answer-key fields are never returned to learners; see services/serializers.js.
 */
import mongoose from 'mongoose';
import { QUESTION_TYPE_VALUES } from '@pollwise/shared/constants';

const { Schema } = mongoose;

const itemSchema = new Schema(
  { id: { type: String, required: true }, text: { type: String, required: true } },
  { _id: false }
);

const pairSchema = new Schema(
  {
    id: { type: String, required: true },
    left: { type: String, required: true },
    right: { type: String, required: true },
    rightId: String,
  },
  { _id: false }
);

export const questionSchema = new Schema({
  type: { type: String, enum: QUESTION_TYPE_VALUES, required: true },
  prompt: { type: String, required: true, maxlength: 500 },
  imageUrl: String,
  explanation: { type: String, maxlength: 500 },
  points: { type: Number, default: 1, min: 0, max: 10 },
  /** Bumped when the question's content changes. Attempts keep the version they started with. */
  version: { type: Number, default: 1, min: 1 },

  // single_choice, multi_choice
  options: { type: [itemSchema], default: undefined },
  correctOptionId: String,
  correctOptionIds: { type: [String], default: undefined },

  // true_false
  correct: Boolean,

  // matching
  pairs: { type: [pairSchema], default: undefined },

  // ordering
  items: { type: [itemSchema], default: undefined },
  correctOrder: { type: [String], default: undefined },

  // fill_blank: one list of accepted answers per blank
  template: String,
  acceptedAnswers: { type: [[String]], default: undefined },
});
