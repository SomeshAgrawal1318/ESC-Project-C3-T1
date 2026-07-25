import mongoose from "mongoose";

const errorTrendSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    totalErrors: {
      type: Number,
      required: true,
      min: 0,
    },

    spellingErrors: {
      type: Number,
      default: 0,
      min: 0,
    },

    grammarErrors: {
      type: Number,
      default: 0,
      min: 0,
    },

    punctuationErrors: {
      type: Number,
      default: 0,
      min: 0,
    },

    commonErrorType: {
      type: String,
      enum: [
        "phonological",
        "orthographic",
        "morphological",
        "capitalisation",
        "punctuation",
        "unsure",
      ],
      default: "unsure",
    },

    commonErrorVariant: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export const ErrorTrend = mongoose.model(
  "ErrorTrend",
  errorTrendSchema,
  "error_trends"
);