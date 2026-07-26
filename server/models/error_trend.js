import mongoose from 'mongoose';

const ERROR_CATEGORIES = [
  'phonological',
  'orthographic',
  'morphological',
  'capitalisation',
  'punctuation',
  'unsure',
];

const taggedErrorSchema = new mongoose.Schema(
  {
    written: {
      type: String,
      default: '',
    },
    intended: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: ERROR_CATEGORIES,
      required: true,
    },
    dismissed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const errorTrendSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    level: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: 'Writing sample',
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ANALYSED', 'PENDING', 'FAILED'],
      default: 'ANALYSED',
    },
    totalErrors: {
      type: Number,
      required: true,
      min: 0,
    },
    errors: {
      type: [taggedErrorSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

errorTrendSchema.index({ studentName: 1, date: 1 });

export const ErrorTrend = mongoose.model(
  'ErrorTrend',
  errorTrendSchema,
  'error_trends',
);
