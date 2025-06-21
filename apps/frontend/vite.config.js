import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode' // ✅ FIX: named import

export default defineConfig({
  plugins: [
    react(),
    qrcode() // ✅ Use the named function
  ],
  server: {
    host: true,
    proxy: {
      '/api': 'http://192.168.1.10:4000', // 👈 replace with your actual local IP
    }
  }
})
