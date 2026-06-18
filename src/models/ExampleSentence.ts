import { Schema, model, models } from 'mongoose'

const ExampleSentenceSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedText: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
    },
    lang: {
      type: String,
      default: 'eng',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    keywords: {
      type: [String],
      default: [],
    },
    topics: {
      type: [String],
      default: [],
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2'],
      default: 'A2',
    },
    sourceName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: '',
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    license: {
      type: String,
      default: '',
    },
    attribution: {
      type: String,
      default: '',
    },
    hasAudio: {
      type: Boolean,
      default: false,
    },
    audioReuseAllowed: {
      type: Boolean,
      default: false,
    },
    fetchedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

ExampleSentenceSchema.index(
  { sourceName: 1, externalId: 1 },
  { unique: true }
)

ExampleSentenceSchema.index({ sourceName: 1, contentHash: 1 })
ExampleSentenceSchema.index({ keywords: 1 })
ExampleSentenceSchema.index({ topics: 1 })
ExampleSentenceSchema.index({ level: 1 })
ExampleSentenceSchema.index({ isActive: 1 })

export const ExampleSentence =
  models.ExampleSentence ||
  model('ExampleSentence', ExampleSentenceSchema, 'example_sentences')
