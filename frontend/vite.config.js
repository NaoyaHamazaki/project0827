import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    // ngrok等のトンネルサービスが発行する動的ホスト名からのアクセスを許可する
    allowedHosts: true,
  },
  preview: {
    // Railway等がデプロイ先に割り当てる動的ホスト名からのアクセスを許可する
    allowedHosts: true,
  },
})
