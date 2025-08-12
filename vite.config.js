// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: If your repository is NOT named "fi-simulator",
// change the base to `/<your-repo-name>/`
export default defineConfig({
  plugins: [react()],
  base: '/fi-simulator/'
})
