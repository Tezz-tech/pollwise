/**
 * A pending signed upload. Created when the admin asks for a signature and consumed when the upload is
 * confirmed. Only a confirmed upload can be referenced by content (SECURITY §7).
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const uploadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    kind: { type: String, enum: ['image', 'pdf'], required: true },
    publicId: { type: String, required: true, unique: true },
    folder: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    /** Set when the upload is confirmed against Cloudinary. Content may only use confirmed uploads. */
    url: String,
    format: String,
    bytes: Number,
    pages: Number,
    confirmedAt: Date,
  },
  { timestamps: true }
);

export const Upload = mongoose.models.Upload || mongoose.model('Upload', uploadSchema);
