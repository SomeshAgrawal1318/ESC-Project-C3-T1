import mongoose from 'mongoose';

import {
  RecommendationReport,
  toPublicRecommendationReport,
} from '../models/recommendationReport.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import { generateReport } from '../services/generateReport.js';
import {
  recommendationEngine,
  RecommendationServiceError,
} from '../services/RecommendationEngine.js';
import { readBoundedResponse } from '../utils/readBoundedResponse.js';

function controllerError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireObjectId(resourceId) {
  if (!mongoose.isObjectIdOrHexString(resourceId)) {
    throw controllerError(400, 'The supplied resource ID is invalid.');
  }
}

function handleControllerFailure(error, response, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  response.status(statusCode);

  // The shared middleware predates 422 and 502 handling. Keep it unchanged as
  // required, while returning the same public shape for recommendation-only
  // validation and upstream failures instead of allowing a request to hang.
  if (statusCode === 422 || statusCode === 502) {
    response.json({
      title: statusCode === 422 ? 'Validation error' : 'Upstream service error',
      message: error.message,
    });
    return;
  }

  if (error instanceof RecommendationServiceError || error?.statusCode) throw error;
  throw new Error(fallbackMessage);
}

async function upsertLatestReport(studentId, generatedReport) {
  try {
    return await RecommendationReport.findOneAndUpdate(
      { student: studentId },
      {
        $set: {
          ...generatedReport,
          generatedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    // Two first-time requests can both generate successfully before either
    // inserts. The unique student index chooses the winner; returning that
    // complete report is safer than retrying with partially different data.
    if (error?.code !== 11000) throw error;
    const winningReport = await RecommendationReport.findOne({ student: studentId });
    if (!winningReport) throw error;
    return winningReport;
  }
}

/** Generate a complete report before atomically replacing the student's old one. */
export async function generateStudentRecommendations(request, response) {
  try {
    const { studentId } = request.params;
    requireObjectId(studentId);

    const student = await Student.findById(studentId);
    if (!student) throw controllerError(404, 'Student not found.');

    const samples = await Sample.find({
      student: studentId,
      status: { $in: ['ANALYSED', 'REVIEWED'] },
    }).sort({ createdAt: 1 });
    const generatedReport = await generateReport(student, samples);
    const savedReport = await upsertLatestReport(studentId, generatedReport);

    response.status(201).json({
      report: toPublicRecommendationReport(savedReport),
    });
  } catch (error) {
    return handleControllerFailure(
      error,
      response,
      'The recommendation report could not be generated.'
    );
  }
}

/** Read the student's current report and compute freshness from its source samples. */
export async function getLatestStudentRecommendations(request, response) {
  try {
    const { studentId } = request.params;
    requireObjectId(studentId);

    const report = await RecommendationReport.findOne({ student: studentId });
    if (!report) {
      throw controllerError(404, 'No recommendation report has been generated.');
    }

    const outdatedEvidence = await Sample.exists({
      student: studentId,
      $or: [
        {
          _id: { $in: report.basedOnSamples },
          updatedAt: { $gt: report.generatedAt },
        },
        {
          _id: { $nin: report.basedOnSamples },
          status: { $in: ['ANALYSED', 'REVIEWED'] },
        },
      ],
    });

    response.status(200).json({
      report: toPublicRecommendationReport(report, {
        isOutdated: Boolean(outdatedEvidence),
      }),
    });
  } catch (error) {
    return handleControllerFailure(
      error,
      response,
      'The recommendation report could not be loaded.'
    );
  }
}

/** Proxy one approved private PDF without revealing its Blob path or SAS token. */
export async function streamWorksheetFile(request, response) {
  try {
    const {
      worksheet,
      response: upstreamResponse,
      maximumBytes,
    } = await recommendationEngine.fetchWorksheet(request.params.worksheetId);
    if (!upstreamResponse.body) {
      throw new RecommendationServiceError(502, 'The worksheet provider returned an empty file.');
    }

    const contentType = upstreamResponse.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!['application/pdf', 'application/octet-stream'].includes(contentType)) {
      throw new RecommendationServiceError(502, 'The worksheet provider did not return a PDF.');
    }

    const declaredBytes = Number.parseInt(upstreamResponse.headers.get('content-length'), 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
      throw new RecommendationServiceError(502, 'The worksheet PDF is too large to open safely.');
    }

    const pdfBytes = await readBoundedResponse(upstreamResponse, maximumBytes, {
      tooLarge: () =>
        new RecommendationServiceError(502, 'The worksheet PDF is too large to open safely.'),
      interrupted: () =>
        new RecommendationServiceError(502, 'The worksheet download was interrupted.'),
    });
    if (!pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new RecommendationServiceError(502, 'The worksheet provider returned an invalid PDF.');
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', `inline; filename="${worksheet.worksheetId}.pdf"`);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.status(200).send(pdfBytes);
  } catch (error) {
    return handleControllerFailure(error, response, 'The worksheet could not be opened.');
  }
}
