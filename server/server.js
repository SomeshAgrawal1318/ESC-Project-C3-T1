import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/dbConnection.js';
import samples from './routes/samples.js';
import students from './routes/students.js';

const port = process.env.PORT || 5000;
const app = express();
connectDB();

app.use('/samples', samples);
app.use('/students', students);
app.use('/recommendation')

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
});


// GET http://localhost:4000/students/