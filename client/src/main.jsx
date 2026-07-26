// Router + providers. Routes for screens beyond 1a/1b (report, upload,
// trends, recommendations) are stubbed as placeholders so the links in the
// UI resolve to an honest "not built yet" instead of a dead end.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import StudentsListPage from './pages/StudentsListPage.jsx';
import StudentProfilePage from './pages/StudentProfilePage.jsx';
import UploadSamplePage from './pages/UploadSamplePage.jsx';
import StyleguidePage from './pages/StyleguidePage.jsx';
import ErrorTrendsPage from './pages/ErrorTrendsPage.jsx';
import Placeholder from './components/Placeholder.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<StudentsListPage />} />
          <Route path="students/:studentId" element={<StudentProfilePage />} />
          {/* Screens 2a/2b — upload + analyse flow */}
          <Route path="students/:studentId/upload" element={<UploadSamplePage />} />
          <Route
              path="students/:studentId/trends"
              element={<ErrorTrendsPage />}
            />
          <Route
            path="students/:studentId/recommendations"
            element={<Placeholder label="Recommendations" />}
          />
          <Route path="samples/:sampleId" element={<Placeholder label="Error report" />} />
          {/* Living design-system reference for the team (see DESIGN.md) */}
          <Route path="styleguide" element={<StyleguidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
