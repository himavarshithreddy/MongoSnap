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
    proxy: {
      '/api': 'http://192.168.1.10:4000', // 
    }
  }
})
