import express from 'express';
import { ErrorTrend } from '../models/error_trend.js';

const router = express.Router();

// GET /api/error-trend/by-name/Wei%20Jie%20Lim
router.get('/by-name/:studentName', async (req, res) => {
  try {
    const studentName = req.params.studentName.trim();

    if (!studentName) {
      return res.status(400).json({
        message: 'A student name is required.',
      });
    }

    const exactName = new RegExp(`^${escapeRegExp(studentName)}$`, 'i');

    const trends = await ErrorTrend.find({
      studentName: exactName,
      status: 'ANALYSED',
    }).sort({ date: 1 });

    if (trends.length === 0) {
      return res.status(404).json({
        message: `No analysed error trends were found for ${studentName}.`,
      });
    }

    return res.status(200).json(trends);
  } catch (error) {
    console.error('Error retrieving student error trends:', error);

    return res.status(500).json({
      message: 'Failed to retrieve error trends.',
      error: error.message,
    });
  }
});

// Existing route kept so it does not break anyone already using it.
router.get('/', async (req, res) => {
  try {
    const trends = await ErrorTrend.find().sort({ date: 1 });
    return res.status(200).json(trends);
  } catch (error) {
    console.error('Error retrieving error trends:', error);

    return res.status(500).json({
      message: 'Failed to retrieve error trends.',
      error: error.message,
    });
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default router;
