import { Schema, model, models } from 'mongoose'

const ApiSyncRunSchema = new Schema(
  {
    sourceKey: {
      type: String,
      required: true,
      trim: true,
    },
    jobName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['running', 'success', 'failed'],
      default: 'running',
    },
    params: {
      type: Schema.Types.Mixed,
      default: {},
    },
    insertedCount: {
      type: Number,
      default: 0,
    },
    updatedCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

ApiSyncRunSchema.index({ sourceKey: 1, createdAt: -1 })
ApiSyncRunSchema.index({ jobName: 1, createdAt: -1 })
ApiSyncRunSchema.index({ status: 1, createdAt: -1 })

export const ApiSyncRun =
  models.ApiSyncRun || model('ApiSyncRun', ApiSyncRunSchema)
