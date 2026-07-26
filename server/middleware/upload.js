// middleware/upload.js
// --------------------
// multer handles the multipart form parsing for sample uploads. files are
// buffered in memory (not written to disk yet) because sampleController
// needs to look at the actual bytes - not just the extension - before
// deciding whether a file is acceptable, and needs the studentId from the
// form body to know where to save them.
//
// the size ceiling lives here (not in sampleController) because multer can
// reject an oversized file before it's even fully buffered into memory.

import multer from "multer";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

export default upload;
