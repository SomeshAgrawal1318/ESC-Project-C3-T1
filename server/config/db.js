// config/db.js
// -------------
// Opens the connection to MongoDB using Mongoose.
//
// Mongoose is a library that sits between our code and MongoDB. It lets us
// describe the shape of our data as "schemas" (see the /models folder) and
// then gives us friendly JavaScript objects to work with, instead of raw
// database commands.

import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectToDatabase() {
  try {
    // mongoose.connect returns a promise, so we wait for it. If MongoDB is
    // not running (or the URI is wrong) this throws, and we explain below.
    await mongoose.connect(config.mongodbUri);
    console.log(`Connected to MongoDB at ${config.mongodbUri}`);
  } catch (error) {
    // A readable message beats a stack trace: the most common cause is
    // simply that MongoDB is not running yet.
    console.error("Could not connect to MongoDB.");
    console.error(`  Tried: ${config.mongodbUri}`);
    console.error("  Is MongoDB running? Start it locally, or put an Atlas");
    console.error("  connection string in server/.env as MONGODB_URI.");
    console.error(`  Original error: ${error.message}`);
    // Exit so the server does not run half-broken with no database.
    process.exit(1);
  }
}
