import express from 'express';

import {
    generateSampleWorksheets,
    getSampleWorksheets,
} from '../controllers/recommendationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.post('/:sampleId/recommendations', asyncHandler(generateSampleWorksheets));
router.get('/:sampleId/recommendations', asyncHandler(getSampleWorksheets));

router.route('/')
    .get((req, res)=>{
        res.send("Hello world");
    });

    

export default router;