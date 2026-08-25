import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths, so the same build works at the domain root, in a
  // GitHub Pages project subpath (/your_trip/) and straight from file://.
  base: './',
})
