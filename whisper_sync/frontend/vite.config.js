import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // sockjs-client uses Node globals — polyfill them for the browser
    global: 'globalThis',
  },
})
