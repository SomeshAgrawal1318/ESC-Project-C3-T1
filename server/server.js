import dotenv from 'dotenv';

dotenv.config();

const [{ default: connectDB }, { default: app }] = await Promise.all([
  import('./config/dbConnection.js'),
  import('./app.js'),
]);

const port = process.env.PORT || 5000;

await connectDB();
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
