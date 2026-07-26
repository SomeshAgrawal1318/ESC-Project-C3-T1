// ------------------------------------------------------------------
// Fixtures that stand in for the backend until the Express routes exist.
// Shapes mirror server/paths.txt so swapping to the real API is a no-op
// for the components. Delete or ignore once VITE_USE_MOCKS=false.
//
// analysisStatus values below use the Sample MODEL vocabulary
// (UPLOADED / ANALYSED / REVIEWED, see server/models/sample.js).
// status.js also understands the paths.txt vocabulary
// (PENDING / PROCESSING / COMPLETE / FAILED), so either is fine.
// ------------------------------------------------------------------

export const mockStudents = [
  { studentId: 'stu_wei', name: 'Wei Jie Lim', currentGrade: 'Primary 4' },
  { studentId: 'stu_aisha', name: 'Aisha Rahman', currentGrade: 'Primary 3' },
  { studentId: 'stu_daniel', name: 'Daniel Ong', currentGrade: 'Primary 5' },
];

export const mockSamplesByStudent = {
  // 1a — a student with several samples (newest first)
  stu_wei: [
    {
      sampleId: 'smp_501',
      title: 'Composition — "My School Holiday"',
      uploadedAt: '2026-07-12T09:15:00.000Z',
      analysisStatus: 'ANALYSED',
      imageCount: 2,
    },
    {
      sampleId: 'smp_498',
      title: 'Spelling exercise — Week 28',
      uploadedAt: '2026-07-10T08:02:00.000Z',
      analysisStatus: 'UPLOADED',
      imageCount: 1,
    },
    {
      sampleId: 'smp_487',
      title: 'Journal entry — 28 Jun',
      uploadedAt: '2026-06-28T14:40:00.000Z',
      analysisStatus: 'REVIEWED',
      imageCount: 1,
    },
    {
      sampleId: 'smp_470',
      title: 'Composition — "My Best Friend"',
      uploadedAt: '2026-06-14T10:20:00.000Z',
      analysisStatus: 'ANALYSED',
      imageCount: 3,
    },
  ],

  // 1b — a student with no samples yet (empty state)
  stu_aisha: [],

  stu_daniel: [
    {
      sampleId: 'smp_512',
      title: 'Dictation — Week 29',
      uploadedAt: '2026-07-18T11:05:00.000Z',
      analysisStatus: 'ANALYSED',
      imageCount: 1,
    },
  ],
};

export const mockReportsBySample = {
  // smp_501 — Wei Jie's most recent analysed sample. Carries one of each
  // card state: normal, uncertain (confidenceScore below the threshold),
  // and teacher-corrected (previousCategory set).
  smp_501: {
    sampleId: 'smp_501',
    studentId: 'stu_wei',
    title: 'Composition — "My School Holiday"',
    analysisStatus: 'ANALYSED',
    pageCount: 1,
    generatedAt: '2026-07-12T09:16:40.000Z',
    statistics: {
      categoryCounts: {
        phonological: 2,
        orthographic: 1,
        morphological: 1,
        capitalisation: 1,
        punctuation: 1,
        unsure: 0,
      },
      total: 6,
    },
    detectedErrors: [
      {
        errorId: 'err_1',
        originalText: 'becos',
        suggestedText: 'because',
        category: 'phonological',
        confidenceScore: 0.92,
        isUncertain: false,
        locationOnScan: { x: 0.12, y: 0.14, width: 0.22, height: 0.05 },
        note: '',
        dismissed: false,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
      {
        errorId: 'err_2',
        originalText: 'swiming pol',
        suggestedText: 'swimming pool',
        category: 'phonological',
        confidenceScore: 0.88,
        isUncertain: false,
        locationOnScan: { x: 0.34, y: 0.27, width: 0.28, height: 0.05 },
        note: '',
        dismissed: false,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
      {
        errorId: 'err_3',
        originalText: 'fone',
        suggestedText: 'phone',
        category: 'phonological',
        confidenceScore: 0.81,
        isUncertain: false,
        locationOnScan: { x: 0.16, y: 0.42, width: 0.16, height: 0.05 },
        note: 'Sound-based substitution, not visual',
        dismissed: false,
        // Teacher-corrected: was tagged orthographic by the AI, reclassified
        // by the educator during review (screen 3b, Person 5's slice).
        previousCategory: 'orthographic',
        correctionNote: 'Sound-based substitution, not visual',
        correctedAt: '2026-07-13T08:02:00.000Z',
      },
      {
        errorId: 'err_4',
        originalText: 'runed',
        suggestedText: 'ran',
        category: 'morphological',
        confidenceScore: 0.48, // below ERROR_CONFIDENCE_THRESHOLD (0.6) -> uncertain
        isUncertain: true,
        locationOnScan: { x: 0.4, y: 0.58, width: 0.2, height: 0.05 },
        note: '',
        dismissed: false,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
      {
        errorId: 'err_5',
        originalText: 'i',
        suggestedText: 'I',
        category: 'capitalisation',
        confidenceScore: 0.95,
        isUncertain: false,
        locationOnScan: { x: 0.13, y: 0.71, width: 0.06, height: 0.05 },
        note: '',
        dismissed: false,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
      {
        errorId: 'err_6',
        originalText: 'went home ',
        suggestedText: 'went home.',
        category: 'punctuation',
        confidenceScore: 0.9,
        isUncertain: false,
        locationOnScan: { x: 0.5, y: 0.84, width: 0.24, height: 0.05 },
        note: '',
        dismissed: false,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
    ],
  },

  // smp_487 — an already-reviewed sample (REVIEWED status), one dismissed
  // error to exercise that filtering path.
  smp_487: {
    sampleId: 'smp_487',
    studentId: 'stu_wei',
    title: 'Journal entry — 28 Jun',
    analysisStatus: 'REVIEWED',
    pageCount: 1,
    generatedAt: '2026-06-28T14:41:10.000Z',
    statistics: {
      categoryCounts: {
        phonological: 1,
        orthographic: 0,
        morphological: 0,
        capitalisation: 0,
        punctuation: 0,
        unsure: 0,
      },
      total: 1,
    },
    detectedErrors: [
      {
        errorId: 'err_10',
        originalText: 'wen',
        suggestedText: 'when',
        category: 'phonological',
        confidenceScore: 0.86,
        isUncertain: false,
        locationOnScan: { x: 0.2, y: 0.2, width: 0.14, height: 0.05 },
        note: '',
        dismissed: false,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
      {
        errorId: 'err_11',
        originalText: 'skool',
        suggestedText: 'school',
        category: 'phonological',
        confidenceScore: 0.65,
        isUncertain: false,
        locationOnScan: { x: 0.4, y: 0.35, width: 0.16, height: 0.05 },
        note: 'False positive - already correct in context',
        // Dismissed: the educator decided this wasn't actually an error.
        // Kept (not deleted) as the audit trail; excluded from statistics.
        dismissed: true,
        previousCategory: null,
        correctionNote: '',
        correctedAt: null,
      },
    ],
  },
};