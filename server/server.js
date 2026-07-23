import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/dbConnection.js';

const port = process.env.PORT || 5000;
const app = express();
connectDB();

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
});