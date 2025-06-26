import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode' 
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    qrcode(),
    tailwindcss()
  ],
  server: {
    host: 'mongosnap.mp',
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../../mongosnap.mp-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../../mongosnap.mp.pem')),
    },
    cors: true,
    allowedHosts: ['mongosnap.mp'],
    proxy: {
      '/api': {
        target: 'https://mongosnap.mp:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
