import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// `base: './'` keeps asset URLs relative, so the same build works at the root of
// a domain (Vercel/Netlify) and under /<repo>/ (GitHub Pages). Routing is
// hash-based, so no server rewrites are needed. Override with VITE_BASE if wanted.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
