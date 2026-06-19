import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API and WebSocket requests to the backend during development
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
      },
      '/health': {
        target: 'http://localhost:8000',
      },
      '/spatial': {
        target: 'http://localhost:8000',
      },
    },
  },
})
