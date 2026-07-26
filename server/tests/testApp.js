// tests/testApp.js
// -----------------
// a minimal Express app wired the same way server.js is, just without
// dotenv/connectDB/app.listen - tests point mongoose at an in-memory Mongo
// instance instead (see sample.routes.test.js) and supertest talks to this
// app object directly, no real port needed.

import express from 'express';
import samples from '../routes/samples.js';
import students from '../routes/students.js';
import errorHandler from '../middleware/errorHandler.js';

export function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/samples', samples);
  app.use('/api/students', students);
  app.use(errorHandler);
  return app;
}
