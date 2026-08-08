import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/dbConnection.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import recommendation from './routes/recommendation.js';
import worksheets from './routes/worksheets.js';
import errorHandler from './middleware/errorHandler.js';
import { prepareRecommendationReportStorage } from './models/recommendationReport.js';

const port = process.env.PORT || 5000;
const app = express();
await connectDB();

try {
  await prepareRecommendationReportStorage();
} catch (error) {
  // Duplicate latest-only reports need an educator-approved migration; never
  // guess which historical report to delete during application startup.
  console.error(error.message);
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use('/api/samples', samples);
app.use('/api/students', students);
app.use('/api/recommendation', recommendation);
app.use('/api/worksheets', worksheets);
app.use(errorHandler);
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// GET http://localhost:4000/students/
// req.body.
// res.status(404);
// throw new Error("asdfasdf");
