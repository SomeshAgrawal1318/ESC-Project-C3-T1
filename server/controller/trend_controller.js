import mongoose from "mongoose";
import {
  Sample,
  ERROR_CATEGORIES
} from "../models/sample.js";

export async function getStudentTrend(req, res) {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        message: "Invalid student ID"
      });
    }

    const samples = await Sample.find({
        student: studentId
        })
      .select("title errors createdAt")
      .sort({ createdAt: 1 })
      .lean();

    const categoryTotals = {};

    for (const category of ERROR_CATEGORIES) {
      categoryTotals[category] = 0;
    }

    let totalErrors = 0;

    const trends = samples.map((sample) => {
      const categoryCounts = {};

      for (const category of ERROR_CATEGORIES) {
        categoryCounts[category] = 0;
      }

      const validErrors = sample.errors.filter(
        (error) => !error.dismissed
      );

      for (const error of validErrors) {
        categoryCounts[error.category] += 1;
        categoryTotals[error.category] += 1;
      }

      totalErrors += validErrors.length;

      return {
        sampleId: sample._id,
        title: sample.title,
        date: sample.createdAt,
        totalErrors: validErrors.length,
        categoryCounts
      };
    });

    let mostCommonError = null;

    if (totalErrors > 0) {
      mostCommonError = Object.entries(categoryTotals).reduce(
        (highest, current) =>
          current[1] > highest[1] ? current : highest
      )[0];
    }

    return res.status(200).json({
      studentId,
      totalSamples: samples.length,
      totalErrors,
      mostCommonError,
      categoryTotals,
      trends
    });
  } catch (error) {
    console.error("Error retrieving student trends:", error);

    return res.status(500).json({
      message: "Failed to retrieve student trends"
    });
  }
}