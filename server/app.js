import cors from 'cors';
import express from 'express';

import errorHandler from './middleware/errorHandler.js';
import requireAuth from './middleware/requireAuth.js';
import auth from './routes/auth.js';
import recommendation from './routes/recommendation.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import worksheets from './routes/worksheets.js';
import { AppError } from './utils/appError.js';

// The single Express app definition — server.js just connects to the
// database and calls app.listen() on this. Keeping route mounting and the
// 404 catch-all in one place means the two can no longer drift apart, the
// way app.js and server.js each independently ended up doing before.
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
// /api/auth is the one router that must stay reachable without a token —
// everything else requires the caller to have already signed in.
app.use('/api/samples', requireAuth, samples);
app.use('/api/students', requireAuth, students);
app.use('/api/worksheets', requireAuth, worksheets);
app.use('/api/recommendation', requireAuth, recommendation);
app.use('/api/auth', auth);
app.use((req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
});
app.use(errorHandler);

export default app;
