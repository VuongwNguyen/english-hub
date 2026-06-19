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
    topicGroup: {
      type: String,
      default: '',
    },
    qualityScore: {
      type: Number,
      default: 0,
    },
    difficultyScore: {
      type: Number,
      default: 0,
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
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    generatedFrom: {
      type: String,
      default: '',
    },
    sourceNames: {
      type: [String],
      default: [],
    },
    sourceUrls: {
      type: [String],
      default: [],
    },
    useCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    lastUsedDate: {
      type: String,
      default: null,
    },
    regeneratedAt: {
      type: Date,
      default: null,
    },
    // --- Phase 5 personalization fields (section 9.2) ---
    // Additive-only optional fields. Existing documents simply have these
    // as undefined/absent until a write path (seed, generation, or the
    // reviewPriority increment below) sets them — no backfill required.
    topics: {
      type: [String],
      default: undefined,
    },
    targetSkills: {
      type: [String],
      enum: ['listening', 'vocab', 'speaking', 'writing', 'dev_english'],
      default: undefined,
    },
    reviewPriority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

LessonSchema.index({ slug: 1 }, { unique: true })
LessonSchema.index({ type: 1, isActive: 1 })
LessonSchema.index({ useCount: 1, lastUsedAt: 1 })
LessonSchema.index({ topic: 1 })
LessonSchema.index({ topicGroup: 1 })
LessonSchema.index({ type: 1, topicGroup: 1, isActive: 1 })
LessonSchema.index({ qualityScore: -1 })
LessonSchema.index({ createdAt: -1 })
LessonSchema.index({ reviewPriority: -1 })

export const Lesson = models.Lesson || model('Lesson', LessonSchema)
