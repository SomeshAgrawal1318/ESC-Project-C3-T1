import express from 'express';

import { streamWorksheetFile } from '../controllers/recommendationController.js';

const router = express.Router();

// Express 5 forwards rejected controller promises to the existing error handler.
router.get('/:worksheetId/file', streamWorksheetFile);

export default router;
