import { Schema, model, models } from 'mongoose'

const WordDefinitionSchema = new Schema(
  {
    partOfSpeech: {
      type: String,
      default: '',
    },
    definition: {
      type: String,
      required: true,
    },
    example: {
      type: String,
      default: '',
    },
    synonyms: {
      type: [String],
      default: [],
    },
    antonyms: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
)

const WordSchema = new Schema(
  {
    word: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedWord: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phonetic: {
      type: String,
      default: '',
    },
    phonetics: {
      type: [
        {
          text: { type: String, default: '' },
          audio: { type: String, default: '' },
        },
      ],
      default: [],
    },
    definitions: {
      type: [WordDefinitionSchema],
      default: [],
    },
    relatedWords: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2'],
      default: 'A2',
    },
    topics: {
      type: [String],
      default: [],
    },
    topicGroups: {
      type: [String],
      default: [],
    },
    sourceNames: {
      type: [String],
      default: [],
    },
    sourceUrls: {
      type: [String],
      default: [],
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

WordSchema.index({ normalizedWord: 1 }, { unique: true })
WordSchema.index({ topics: 1 })
WordSchema.index({ topicGroups: 1 })
WordSchema.index({ level: 1 })
WordSchema.index({ isActive: 1 })

export const Word = models.Word || model('Word', WordSchema)
