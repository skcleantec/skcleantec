import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'es2020',
  },
  server: {
    host: true, // 모바일에서 같은 Wi-Fi로 접속 가능
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
