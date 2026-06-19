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
      // Note: legacy documents persisted before this enum was tightened may
      // still have status: 'done' on disk (Mongoose only validates on
      // write, not read), which would fail validation on a bare re-save.
      // See isItemDone() in src/server/learning/progress.ts for why 'done'
      // is treated as equivalent to 'completed' everywhere it matters.
      enum: ['pending', 'in_progress', 'completed', 'skipped'],
      default: 'pending',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    activeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
