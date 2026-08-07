// services/analysisTrigger.js
// ----------------------------
// the hand-off point to the AI analysis engine (a different slice - not
// built yet). this is a no-op for now, left here on purpose so whoever
// builds the engine only has to replace the body of this function instead
// of reopening the upload handler in sampleController.js.
//
// once it exists, this is where analyse(sample) gets called after the 202
// response has already gone out, and where status eventually moves from
// UPLOADED to ANALYSED or FAILED.

export function triggerAnalysis(sample) {
  // no-op until the analysis engine exists
}
