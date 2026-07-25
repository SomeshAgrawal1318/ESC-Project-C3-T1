import express from "express";
import { ErrorTrend } from "../models/error_trend.js";

const router = express.Router();

// GET all error-trend records
router.get("/", async (req, res) => {
  try {
    const trends = await ErrorTrend.find().sort({ date: 1 });

    return res.status(200).json(trends);
  } catch (error) {
    console.error("Error retrieving error trends:", error);

    return res.status(500).json({
      message: "Failed to retrieve error trends",
      error: error.message,
    });
  }
});

export default router;