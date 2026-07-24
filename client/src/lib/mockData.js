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
