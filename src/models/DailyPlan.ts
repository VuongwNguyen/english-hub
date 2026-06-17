import { Schema, model, models } from 'mongoose'

const DailyPlanItemSchema = new Schema(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['listening', 'vocab', 'speaking', 'writing', 'dev_english'],
    },
    title: {
      type: String,
      required: true,
      trim: true,
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
    status: {
      type: String,
      enum: ['pending', 'done', 'skipped'],
      default: 'pending',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  }
)

const DailyPlanSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    theme: {
      type: String,
      default: null,
    },
    items: {
      type: [DailyPlanItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

DailyPlanSchema.index({ date: 1 }, { unique: true })

export const DailyPlan =
  models.DailyPlan || model('DailyPlan', DailyPlanSchema)
