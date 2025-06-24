import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode' 
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    qrcode(),
    tailwindcss()
  ],
  server: {
    host: true,
    allowedHosts: ['mongopilot.mp'],
    proxy: {
      '/api': {
        target: 'http://mongopilot.mp:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
