import express from 'express';

import {
  generateStudentRecommendations,
  getLatestStudentRecommendations,
} from '../controllers/recommendationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.post('/:studentId/recommendations', asyncHandler(generateStudentRecommendations));
router.get('/:studentId/recommendations/latest', asyncHandler(getLatestStudentRecommendations));

router.route('/')
    .get((req, res) =>{
        res.send('Hi Im a student');
    });

export default router;