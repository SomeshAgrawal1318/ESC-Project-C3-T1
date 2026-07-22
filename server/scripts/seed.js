// Seeds the local DB with a few students/samples so there's something to
// look at during dev. Run with `npm run seed` from /server.
// Wipes students + samples first - never point this at a shared DB.

import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config/config.js";
import { Student } from "../models/Student.js";
import { Sample } from "../models/Sample.js";

// 1x1 PNG so the review screen has an image URL to resolve - not meant to
// look like an actual scan.
const PLACEHOLDER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

// All made up - not real students.
const SEED_STUDENTS = [
  {
    externalRef: "Student-60570",
    samples: [
      {
        taskType: "NARRATIVE",
        status: "REVIEWED",
        illegibleNote: "",
        errors: [
          {
            written: "panishment",
            intended: "punishment",
            category: "phonological",
            note: "spelled the way it sounds",
            dismissed: false,
          },
          {
            written: "form",
            intended: "from",
            category: "orthographic",
            note: "letters swapped",
            dismissed: false,
          },
          {
            written: "tom",
            intended: "Tom",
            category: "capitalisation",
            note: "proper noun not capitalised",
            dismissed: true,
          },
        ],
      },
      {
        taskType: "EDIT_DIAGRAM",
        status: "UPLOADED",
        answerKey: "The cat sat on the mat.",
        errors: [],
      },
    ],
  },
  {
    externalRef: "Student-60571",
    samples: [
      {
        taskType: "NARRATIVE",
        status: "ANALYSED",
        illegibleNote: "One word in the margin could not be read.",
        errors: [
          {
            written: "regreted",
            intended: "regretted",
            category: "morphological",
            note: "missing doubled consonant before -ed",
            dismissed: false,
          },
          {
            written: "wont",
            intended: "won't",
            category: "punctuation",
            note: "missing apostrophe",
            dismissed: false,
          },
        ],
      },
    ],
  },
  {
    externalRef: "Student-60572",
    samples: [
      {
        taskType: "OTHER",
        status: "REVIEWED",
        errors: [
          {
            written: "recieve",
            intended: "receive",
            category: "orthographic",
            note: "i-before-e reversed",
            dismissed: false,
          },
        ],
      },
    ],
  },
];

async function writePlaceholderImage(uploadsFolder, filename) {
  const buffer = Buffer.from(PLACEHOLDER_PNG_BASE64, "base64");
  fs.writeFileSync(path.join(uploadsFolder, filename), buffer);
}

async function seed() {
  await mongoose.connect(config.mongodbUri);
  console.log(`Connected to ${config.mongodbUri}`);

  const thisFilePath = fileURLToPath(import.meta.url);
  const serverFolder = path.dirname(path.dirname(thisFilePath));
  const uploadsFolder = path.join(serverFolder, "uploads");
  fs.mkdirSync(uploadsFolder, { recursive: true });

  console.log("Clearing existing students and samples...");
  await Student.deleteMany({});
  await Sample.deleteMany({});

  let studentCount = 0;
  let sampleCount = 0;

  for (const seedStudent of SEED_STUDENTS) {
    const student = await Student.create({
      externalRef: seedStudent.externalRef,
    });
    studentCount += 1;

    for (const seedSample of seedStudent.samples) {
      const filename = `seed-${student._id}-${sampleCount}.png`;
      await writePlaceholderImage(uploadsFolder, filename);

      await Sample.create({
        student: student._id,
        imagePath: path.join(uploadsFolder, filename),
        originalFilename: filename,
        taskType: seedSample.taskType,
        answerKey: seedSample.answerKey || "",
        status: seedSample.status,
        errors: seedSample.errors || [],
        illegibleNote: seedSample.illegibleNote || "",
      });
      sampleCount += 1;
    }
  }

  console.log(`Seeded ${studentCount} students and ${sampleCount} samples.`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
