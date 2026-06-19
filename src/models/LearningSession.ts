import { Schema, model, models } from 'mongoose'

const EventCountsSchema = new Schema(
  {
    heartbeat: {
      type: Number,
      default: 0,
    },
    interaction: {
      type: Number,
      default: 0,
    },
    audioProgress: {
      type: Number,
      default: 0,
    },
    textChange: {
      type: Number,
      default: 0,
    },
    record: {
      type: Number,
      default: 0,
    },
    evaluation: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
)

const MetricsSchema = new Schema(
  {
    audioProgressPercent: {
      type: Number,
      default: null,
    },
    viewedWordCount: {
      type: Number,
      default: null,
    },
    totalWordCount: {
      type: Number,
      default: null,
    },
    practiceCount: {
      type: Number,
      default: null,
    },
    recordedSeconds: {
      type: Number,
      default: null,
    },
    speechAttemptCount: {
      type: Number,
      default: null,
    },
    typedWordCount: {
      type: Number,
      default: null,
    },
    typedCharacterCount: {
      type: Number,
      default: null,
    },
    interactionCount: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
)

const LearningSessionSchema = new Schema(
  {
    userId: {
      type: String,
      default: null,
    },
    anonymousId: {
      type: String,
      default: null,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
    },
    dailyPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'DailyPlan',
      required: true,
    },
    itemId: {
      type: String,
      required: true,
    },
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
    },
    lessonType: {
      type: String,
      required: true,
      enum: ['listening', 'vocab', 'speaking', 'writing', 'dev_english'],
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    startedAt: {
      type: Date,
      required: true,
    },
    lastActiveAt: {
      type: Date,
      required: true,
    },
    completedAt: {
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
    eventCounts: {
      type: EventCountsSchema,
      default: () => ({}),
    },
    metrics: {
      type: MetricsSchema,
      default: () => ({}),
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

LearningSessionSchema.index({ dateKey: 1, itemId: 1 })
LearningSessionSchema.index(
  { dailyPlanId: 1, itemId: 1 },
  { unique: true }
)
LearningSessionSchema.index({ userId: 1, dateKey: 1 })
LearningSessionSchema.index({ anonymousId: 1, dateKey: 1 })

export const LearningSession =
  models.LearningSession || model('LearningSession', LearningSessionSchema)
