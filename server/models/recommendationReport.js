// One set of intervention strategies generated for a student, based on their
// analysed samples. Strategies are embedded (same call as Sample.errors) -
// a report is always read as one whole. "based on SampleReport" in the class
// diagram maps to Sample here, since we don't have a separate SampleReport
// collection (see docs/decisions-log.md).

import mongoose from "mongoose";

export const RECOMMENDATION_STATUSES = ["CURRENT", "OUTDATED", "SUPERSEDED"];

const strategySchema = new mongoose.Schema(
  {
    strategy: { type: String, required: true },
    rationale: { type: String, required: true },
  },
  { _id: false }
);

const recommendationReportSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    basedOnSamples: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Sample" },
    ],

    strategies: { type: [strategySchema], default: [] },

    status: {
      type: String,
      enum: RECOMMENDATION_STATUSES,
      default: "CURRENT",
    },

    // // A teacher can dismiss the "may be outdated" banner without
    // // regenerating - the report stays active, this just silences the flag.
    // outdatedFlagDismissed: { type: Boolean, default: false },
    // commented out by Somesh: I feel it doesn't make sense can just change the status back to CURRENT

    // Set on the new report when it replaces an older one (regenerate flow).
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecommendationReport",
      default: null,
    },
  },
  { timestamps: true } // createdAt covers "generatedAt" from the diagram
);

export const RecommendationReport = mongoose.model(
  "RecommendationReport",
  recommendationReportSchema
);