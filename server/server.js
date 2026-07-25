import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

import connectDB from './config/dbConnection.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import recommendation from './routes/recommendation.js';
import errorTrend from './routes/error_trend.js';
import errorHandler from './middleware/errorHandler.js';

const port = process.env.PORT || 5000;
const app = express();

connectDB();

// Must appear before the routes
app.use(cors());
app.use(express.json());

app.use('/api/samples', samples);
app.use('/api/students', students);
app.use('/api/recommendation', recommendation);
app.use('/api/error-trend', errorTrend);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});