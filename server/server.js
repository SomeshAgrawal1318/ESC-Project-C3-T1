import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import connectDB from './config/dbConnection.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import recommendation from './routes/recommendation.js';
import worksheets from './routes/worksheets.js';
import auth from './routes/auth.js';
import errorHandler from './middleware/errorHandler.js';

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/samples', samples);
app.use('/api/students', students);
app.use('/api/recommendation', recommendation);
app.use('/api/worksheets', worksheets);
app.use('/api/auth', auth);
app.use(errorHandler);

await connectDB();
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
