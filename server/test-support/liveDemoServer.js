import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
process.chdir(serverDirectory);
dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });

if (process.env.RUN_LIVE_DEMO !== 'true') {
  throw new Error('Live demo server requires RUN_LIVE_DEMO=true.');
}
if (!process.env.GEMINI_API_KEY) {
  throw new Error('Live demo requires GEMINI_API_KEY in the ignored server/.env file.');
}

process.env.NODE_ENV = 'test';
process.env.USE_MOCK_AI = 'false';
process.env.RECOMMENDATION_USE_MOCKS = 'true';
process.env.JWT_SECRET = 'lexipath-live-demo-ephemeral-secret';

const STUDENT_ID = new mongoose.Types.ObjectId('64b000000000000000000201');
const username = 'LiveDemo@DAS';
const password = 'LiveDemo@123';
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());

const [{ default: app }, { Account }, { Student }] = await Promise.all([
  import('../app.js'),
  import('../models/account.js'),
  import('../models/student.js'),
]);

await Account.create({
  username,
  email: 'live-demo@example.invalid',
  passwordHash: await bcrypt.hash(password, 4),
  name: 'Live Demo Educator',
  role: 'Educator',
  organisation: 'Ephemeral Test School',
});
await Student.create({
  _id: STUDENT_ID,
  name: 'Live Demo Learner',
  currentGrade: 'Primary 4',
});

const port = Number(process.env.PORT) || 5001;
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`LexiPath live-demo API ready on http://127.0.0.1:${port}`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
  await fs.rm(path.join(serverDirectory, 'samples', String(STUDENT_ID)), {
    recursive: true,
    force: true,
  });
}

process.once('SIGTERM', () => stop().finally(() => process.exit(0)));
process.once('SIGINT', () => stop().finally(() => process.exit(0)));