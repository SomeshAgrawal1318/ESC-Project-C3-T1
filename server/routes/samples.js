import express from 'express';
import path from 'path';
import fs from 'fs';
import {Sample} from '../models/sample.js';
import reportController from '../controllers/reportController.js';
import constants from '../constants.js';
import { report } from 'process';

const router = express.Router();

router.route('/')
    .get((req, res)=>{
        res.send("Hello world");
    });

// GET /api/samples/:sampleId/report
router.get('/:sampleId/report', async (req, res) => {
    try {
        const report = await reportController.getErrorReport(req.params.sampleId);
        res.status(200).json(report);
    } catch (err) {
        const status = err.status || constants.INTERNAL_SERVER_ERROR;
        res
            .status(status)
            .json(reportController.errorEnvelope('SAMPLE_NOT_FOUND', err.message))
    }
});

// GET /api/samples/:sampleId/images/:index
router.get('/:sampleId/images/:index', async (req, res) => {
    try {
        const sample = await Sample.findById(req.params.sampleId);
        if (!sample) {
            return res
                .status(constants.NOT_FOUND)
                .json(reportController.errorEnvelope('SAMPLE_NOT_FOUND', `No sample found with id ${req.params.sampleId}`));
        }
        const index = Number(req.params.index);
        const page = sample.pages[index];
        if (!page) {
            return res
                .status(constants.NOT_FOUND)
                .json(reportController.errorEnvelope('PAGE_NOT_FOUND', `Sample has no page at index ${index}`));
        }
        const absolutePath = path.resolve(page.imagePath);
        if (!fs.existsSync(absolutePath)) {
            return res
                .status(constants.NOT_FOUND)
                .json(reportController.errorEnvelope('IMAGE_NOT_FOUND', `Stored image file is missing`));
        }
        return res.sendFile(absolutePath);
    } catch (err) {
        return res
            .status(constants.INTERNAL_SERVER_ERROR)
            .json(reportController.errorEnvelope('INTERNAL_ERROR', err.message));
    }
});

export default router;