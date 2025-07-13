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
    host: '0.0.0.0',
    port: 5173,
 
    cors: true,
    
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        
      }
    }
  }
})
