import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps every asset reference relative, so the same build works on
// GitHub Pages project sites, user sites and plain static hosts without edits.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    cssTarget: 'safari15',
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5183, host: true },
})
