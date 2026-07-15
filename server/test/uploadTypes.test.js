import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedUploadMimeType } from "../routes/samples.js";

test("upload validation accepts supported images and PDF documents", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
    assert.equal(isSupportedUploadMimeType(type), true, type);
  }
});

test("upload validation rejects unrelated file types", () => {
  assert.equal(isSupportedUploadMimeType("text/plain"), false);
});
