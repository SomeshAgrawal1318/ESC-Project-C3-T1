// index.js
// ---------
// The entry point of the LexiPath backend. Running `npm run dev` starts here.
//
// This file does three things, in order:
//   1. connects to MongoDB (config/db.js)
//   2. sets up the Express app and its middleware
//   3. starts listening for requests from the React frontend

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/config.js";
import { connectToDatabase } from "./config/db.js";
import { samplesRouter } from "./routes/samples.js";

// Connect to the database first - the routes are useless without it,
// and db.js exits with a readable message if MongoDB isn't reachable.
await connectToDatabase();

const app = express();

// cors lets the React dev server (a different port) call this API.
app.use(cors());

// express.json() parses JSON request bodies onto request.body.
app.use(express.json());

// Serve the uploaded scans as plain files, so the frontend can show the
// original image next to the flagged errors (the heart of the review screen).
// A stored imagePath like "uploads/12345-scan.jpg" becomes the URL
// "/uploads/12345-scan.jpg".
const thisFilePath = fileURLToPath(import.meta.url);
const serverFolder = path.dirname(thisFilePath);
app.use("/uploads", express.static(path.join(serverFolder, "uploads")));

// All the sample endpoints live in routes/samples.js.
app.use("/api/samples", samplesRouter);

// A tiny health check - handy for confirming the server is up.
app.get("/api/health", (request, response) => {
  response.json({ status: "ok", message: "LexiPath server is running." });
});

app.listen(config.port, () => {
  console.log(`LexiPath server listening on http://localhost:${config.port}`);
});
