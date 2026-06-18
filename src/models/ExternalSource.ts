import { Schema, model, models } from 'mongoose'

const ExternalSourceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    baseUrl: {
      type: String,
      required: true,
    },
    docsUrl: {
      type: String,
      default: null,
    },
    licenseNote: {
      type: String,
      default: '',
    },
    attributionRequired: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

ExternalSourceSchema.index({ key: 1 }, { unique: true })

export const ExternalSource =
  models.ExternalSource ||
  model('ExternalSource', ExternalSourceSchema, 'external_sources')
