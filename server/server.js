import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/dbConnection.js';
import samples from './routes/samples.js';
import students from './routes/students.js';
import recommendation from './routes/recommendation.js';
import errorHandler from './middleware/errorHandler.js';

const port = process.env.PORT || 5000;
const app = express();
connectDB();
app.use(cors());
app.use(express.json());
app.use('/api/samples', samples);
app.use('/api/students', students);
app.use('/api/recommendation', recommendation);
app.use(errorHandler);
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// GET http://localhost:4000/students/
// req.body.
// res.status(404);
// throw new Error("asdfasdf");
