import { Schema, model, models } from 'mongoose'

const LessonSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2'],
      default: 'A2',
    },
    type: {
      type: String,
      required: true,
      enum: ['listening', 'vocab', 'speaking', 'writing', 'dev_english'],
    },
    content: {
      type: String,
      required: true,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    estimatedMinutes: {
      type: Number,
      default: 5,
      min: 1,
    },
    wordsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    speakingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    writingSentences: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

LessonSchema.index({ type: 1, isActive: 1 })
LessonSchema.index({ topic: 1 })
LessonSchema.index({ createdAt: -1 })

export const Lesson = models.Lesson || model('Lesson', LessonSchema)
