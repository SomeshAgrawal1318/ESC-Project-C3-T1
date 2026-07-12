// vite.config.js
// ---------------
// Configuration for Vite, the tool that runs the React dev server and
// bundles the app for production.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(), // teaches Vite to understand JSX
    tailwindcss(), // generates the Tailwind utility classes we use
  ],
  server: {
    // The proxy forwards these requests from the dev server (port 5173) to
    // our Express backend (port 5000). That way the frontend can simply call
    // fetch("/api/samples") with no server address and no CORS trouble.
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000', // the scanned images
    },
  },
})
