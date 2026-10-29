import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_TARGET = 'http://127.0.0.1:5050'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
      '/static': API_TARGET,
    },
  },
})
