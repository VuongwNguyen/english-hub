import { Schema, model, models } from 'mongoose'

const DailyStatsSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    doneItems: {
      type: Number,
      default: 0,
    },
    skippedItems: {
      type: Number,
      default: 0,
    },
    pendingItems: {
      type: Number,
      default: 0,
    },
    minutesSpent: {
      type: Number,
      default: 0,
    },
    activeSeconds: {
      type: Number,
      default: 0,
    },
    wordsLearned: {
      type: Number,
      default: 0,
    },
    speakingMinutes: {
      type: Number,
      default: 0,
    },
    writingSentences: {
      type: Number,
      default: 0,
    },
    comeback: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

DailyStatsSchema.index({ date: 1 }, { unique: true })

export const DailyStats =
  models.DailyStats || model('DailyStats', DailyStatsSchema)
