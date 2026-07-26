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

// ------------------------------------------------------------------
// Mock upload + polling, so the upload modal's states (2a-2d) and the
// polling loop are demoable without the backend. Not persisted across a
// reload - it's just in-memory state for this mock module.
// ------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const POLLS_UNTIL_ANALYSED = 2; // pretend the AI takes a couple of polls

let mockSampleSeq = 900;
const mockSamplesById = {};

export function mockCreateSample(studentId, files) {
  const badFile = files.find(
    (file) => !ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
  if (badFile) {
    const error = new Error(
      `"${badFile.name}" is not a supported file. Only JPG, PNG and PDF are accepted.`
    );
    error.status = 422;
    throw error;
  }

  const sampleId = `smp_mock_${mockSampleSeq++}`;
  const title = files[0].name.replace(/\.[^/.]+$/, '') || 'Untitled sample';
  const uploadedAt = new Date().toISOString();

  mockSamplesById[sampleId] = {
    sampleId,
    studentId,
    uploadedAt,
    analysisStatus: 'UPLOADED',
    imageCount: files.length,
    pollCount: 0,
  };

  // Show up in the profile's sample list right away, same as a real 202
  // response would once the list is refetched.
  mockSamplesByStudent[studentId] = [
    { sampleId, title, uploadedAt, analysisStatus: 'UPLOADED', imageCount: files.length },
    ...(mockSamplesByStudent[studentId] ?? []),
  ];

  return { sampleId, studentId, uploadedAt, analysisStatus: 'UPLOADED', imageCount: files.length };
}

export function mockGetSample(sampleId) {
  const sample = mockSamplesById[sampleId];
  if (!sample) return null;

  sample.pollCount += 1;
  if (sample.pollCount >= POLLS_UNTIL_ANALYSED && sample.analysisStatus === 'UPLOADED') {
    sample.analysisStatus = 'ANALYSED';
    const listEntry = mockSamplesByStudent[sample.studentId]?.find(
      (s) => s.sampleId === sampleId
    );
    if (listEntry) listEntry.analysisStatus = 'ANALYSED';
  }

  return {
    sampleId: sample.sampleId,
    studentId: sample.studentId,
    uploadedAt: sample.uploadedAt,
    analysisStatus: sample.analysisStatus,
    imageCount: sample.imageCount,
  };
}
