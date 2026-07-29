import cors from 'cors';
import express from 'express';

import errorHandler from './middleware/errorHandler.js';
import recommendation from './routes/recommendation.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import worksheets from './routes/worksheets.js';
import { AppError } from './utils/appError.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api/samples', samples);
app.use('/api/students', students);
app.use('/api/worksheets', worksheets);
app.use('/api/recommendation', recommendation);
app.use((req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
});
app.use(errorHandler);

export default app;
