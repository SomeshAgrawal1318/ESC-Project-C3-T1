// controllers/reportController.js
// 4: Error Report & Review Screen

// Sample.errors[] instead of SampleReport with an embedded detectedErrors[] array
// getErrorReport() assembles "SampleReport-shaped" response by reading
// straight off the Sample document rather than a separate collection.

import mongoose from "mongoose";
import {Sample, ERROR_CATEGORIES} from "../models/sample.js";
import constants from "../constants.js";

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.status = constants.NOT_FOUND;
    }
}

function errorEnvelope(code, message) {
    return { error: {code, message} };
}

function serialiseError(errorDoc) {
    const isUncertain = errorDoc.confidenceScore < constants.ERROR_CONFIDENCE_THRESHOLD;
    return {
        errorId: errorDoc._id.toString(),
        originalText: errorDoc.written,
        suggestedText: errorDoc.intended || null,
        category: errorDoc.category,
        confidenceScore: errorDoc.confidenceScore, isUncertain,
        locationOnScan: errorDoc.locationOnScan ? {
            x: errorDoc.locationOnScan.x,
            y: errorDoc.locationOnScan.y,
            width: errorDoc.locationOnScan.width,
            height: errorDoc.locationOnScan.height,
        } : null,
        note: errorDoc.note || "",
        dismissed: errorDoc.dismissed,
        previousCategory: errorDoc.previousCategory || null,
        correctionNote: errorDoc.correctionNote || "",
        correctedAt: errorDoc.correctedAt || null,
    };
}

// counts errors per category and in total
// dismissed errors are excluded
function buildStatistics(errors) {
    const categoryCounts = Object.fromEntries(
        ERROR_CATEGORIES.map((category) => [category, 0])
    );

    let total = 0;
    for (const error of errors) {
        if (error.dismissed) continue;
        categoryCounts[error.category] = (categoryCounts[error.category || 0]) + 1;
        total += 1;
    }
    
    return {categoryCounts, total};
}

// ReportController.getErrorReport(sampleId) : SampleReport
async function getErrorReport(sampleId) {
    if (!mongoose.Types.ObjectId.isValid(sampleId)) {
        throw new NotFoundError(`No sample found with id ${sampleId}`);
    }

    const sample = await Sample.findById(sampleId);

    if (!sample) {
        throw new NotFoundError(`No sample found with id ${sampleId}`);
    }

    // Sample not analysed yet
    // client should poll GET /api/samples/:sampleId
    if (sample.status == "UPLOADED") {
        throw new NotFoundError(`Sample with id ${sampleId} has not been analysed yet. Poll GET /api/samples/${sampleId}.`);
    }

    return {
        sampleId: sample._id.toString(),
        studentId: sample.student.toString(),
        title: sampleTitle(sample),
        analysisStatus: sample.status, // UPLOADED | ANALYSED | REVIEWED - see src/lib/status.js on the client
        generatedAt: sample.updatedAt, // no separate SampleReport.generatedAt - reuse the sample's own timestamp
        statistics: buildStatistics(sample.errors),
        detectedErrors: sample.errors.map(serialiseError),
    };
}

function sampleTitle(sample) {
    return sample.title || `${sample.taskType ?? "Writing Sample"}`;
}

export default {getErrorReport, errorEnvelope, NotFoundError};