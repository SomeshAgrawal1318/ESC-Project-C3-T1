import express from "express";
import { getStudentTrend } from "../controller/trend_controller.js";

const router = express.Router();

router.get("/:studentId/trend", getStudentTrend);

export default router;