/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '..',
  server: {
    host: true,
    port: 5173,
  },
  test: {
    // No DOM needed yet — every test file so far is pure logic (the admin
    // create-wizard state machine), not component rendering. Add jsdom +
    // set environment: 'jsdom' here once a test actually needs one.
    globals: false,
  },
})
