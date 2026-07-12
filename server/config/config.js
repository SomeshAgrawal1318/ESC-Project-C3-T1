// config/config.js
// -----------------
// Reads the app's settings from the .env file and exports them as one object.
// Every other file gets its settings from here, so there is exactly one place
// to look when you wonder "where does this value come from?".

// dotenv reads the key=value lines in /server/.env and copies them onto
// process.env, Node's built-in bag of environment variables.
import "dotenv/config";

export const config = {
  // The port the Express server listens on.
  port: process.env.PORT || 5000,

  // Where MongoDB lives. Defaults to a local database called "lexipath".
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lexipath",

  // The secret key for the Gemini API. There is no safe default for a secret,
  // so this stays empty until you fill in .env - the Gemini service checks
  // for it and gives a readable error if it is missing.
  geminiApiKey: process.env.GEMINI_API_KEY || "",

  // Which Gemini model to call. A free-tier Flash model that can read images.
  // (gemini-2.5-flash is retired for new API keys as of July 2026.)
  geminiModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
};
