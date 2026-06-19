import { Schema, model, models } from 'mongoose'

const RubricSchema = new Schema(
  {
    completion: {
      type: Number,
      default: null,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    vocabulary: {
      type: Number,
      default: null,
    },
    structure: {
      type: Number,
      default: null,
    },
    clarity: {
      type: Number,
      default: null,
    },
    pronunciation: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
)

const UserInputSchema = new Schema(
  {
    text: {
      type: String,
      default: null,
    },
    transcript: {
      type: String,
      default: null,
    },
    selectedAnswers: {
      type: [String],
      default: undefined,
    },
  },
  { _id: false }
)

const FeedbackSchema = new Schema(
  {
    summary: {
      type: String,
      required: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    improvements: {
      type: [String],
      default: [],
    },
    correctedText: {
      type: String,
      default: null,
    },
  },
  { _id: false }
)

const LessonEvaluationSchema = new Schema(
  {
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
      enum: ['pending', 'evaluated', 'needs_retry'],
      default: 'pending',
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    rubric: {
      type: RubricSchema,
      default: () => ({}),
    },
    answers: {
      type: Schema.Types.Mixed,
      default: null,
    },
    userInput: {
      type: UserInputSchema,
      default: () => ({}),
    },
    feedback: {
      type: FeedbackSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

LessonEvaluationSchema.index({ dailyPlanId: 1, itemId: 1 }, { unique: true })
LessonEvaluationSchema.index({ dateKey: 1, lessonType: 1 })

export const LessonEvaluation =
  models.LessonEvaluation || model('LessonEvaluation', LessonEvaluationSchema)
