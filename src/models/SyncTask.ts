import { Schema, model, models } from 'mongoose'

const SyncTaskSchema = new Schema(
  {
    taskKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'datamuse_expand',
        'dictionary_enrich',
        'tatoeba_sentence_search',
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed'],
      default: 'pending',
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    topicGroup: {
      type: String,
      required: true,
      trim: true,
    },
    keyword: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    priority: {
      type: Number,
      default: 0,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
)

SyncTaskSchema.index({ taskKey: 1 }, { unique: true })
SyncTaskSchema.index({ status: 1, priority: -1, createdAt: 1 })
SyncTaskSchema.index({ type: 1, status: 1 })
SyncTaskSchema.index({ topic: 1 })
SyncTaskSchema.index({ topicGroup: 1 })

export const SyncTask = models.SyncTask || model('SyncTask', SyncTaskSchema, 'sync_tasks')
