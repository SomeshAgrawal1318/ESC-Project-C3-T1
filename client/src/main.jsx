// Router + providers. Routes for screens beyond 1a/1b (report, upload,
// trends, recommendations) are stubbed as placeholders so the links in the
// UI resolve to an honest "not built yet" instead of a dead end.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { ComfortProvider } from './context/ComfortContext.jsx';
import StudentsListPage from './pages/StudentsListPage.jsx';
import StudentProfilePage from './pages/StudentProfilePage.jsx';
import StyleguidePage from './pages/StyleguidePage.jsx';
import Placeholder from './components/Placeholder.jsx';
import ErrorReportPage from './pages/ErrorReportPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ComfortProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<StudentsListPage />} />
            <Route path="students/:studentId" element={<StudentProfilePage />} />
            <Route
              path="students/:studentId/trends"
              element={<Placeholder label="Error trends" />}
            />
            <Route
              path="students/:studentId/recommendations"
              element={<Placeholder label="Recommendations" />}
            />
            <Route
              path="samples/:sampleId"
              element={<ErrorReportPage />}
            />
            {/* Living design-system reference for the team (see DESIGN.md) */}
            <Route path="styleguide" element={<StyleguidePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ComfortProvider>
  </StrictMode>,
);
