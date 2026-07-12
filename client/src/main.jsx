// src/main.jsx
// -------------
// The entry point of the React app. Vite loads this file first; it mounts
// the <App /> component into the <div id="root"> in index.html.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // StrictMode is a development-only helper that surfaces common React
  // mistakes early (it renders components twice on purpose in dev).
  <StrictMode>
    <App />
  </StrictMode>,
)
