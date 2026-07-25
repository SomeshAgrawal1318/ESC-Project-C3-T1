import express from 'express';

import samples from './routes/samples.js';
import students from './routes/students.js';
import worksheets from './routes/worksheets.js';
import errorHandler from './middleware/errorHandler.js';
import { AppError } from './utils/appError.js';

const app = express();

// Log one completion line per API request without recording query strings or bodies.
function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const requestPath = req.originalUrl.split('?', 1)[0];
  res.on('finish', () => {
    console.info(
      `[http] ${req.method} ${requestPath} ${res.statusCode} ${Date.now() - startedAt}ms`,
    );
  });
  next();
}

app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));
app.use('/api/samples', samples);
app.use('/api/students', students);
app.use('/api/worksheets', worksheets);
app.use((req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
});
app.use(errorHandler);

export default app;
