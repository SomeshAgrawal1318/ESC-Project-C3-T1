import dotenv from 'dotenv';

dotenv.config();

import connectDB from './config/dbConnection.js';
import app from './app.js';

const port = process.env.PORT || 5000;

await connectDB();
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
