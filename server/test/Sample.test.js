import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Sample } from "../models/Sample.js";

test("Sample stores the Team 1 handoff and structured ErrorPatternReport", () => {
  const report = {
    summary: {
      total_characters_analyzed: 11,
      total_errors: 1,
      error_percentage: "9.1%",
      primary_prevention_track: { trackId: "TRK_1", label: "Phonics Review" },
    },
    errors: [
      {
        value: "e",
        category: "omission_error",
        track: { trackId: "TRK_1", label: "Phonics Review" },
        context_snippet: "I hav a cat",
      },
    ],
  };
  const sample = new Sample({
    student: new mongoose.Types.ObjectId(),
    imagePath: "uploads/sample.png",
    taskType: "OTHER",
    raw_text: "I hav a cat",
    corrected_text: "I have a cat",
    errorPatternReport: report,
  });

  assert.equal(sample.validateSync(), undefined);
  assert.equal(sample.raw_text, "I hav a cat");
  assert.equal(sample.corrected_text, "I have a cat");
  assert.deepEqual(sample.errorPatternReport.toObject(), report);
});
