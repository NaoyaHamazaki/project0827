import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // このPC上には他プロジェクトの開発サーバーも同時に動いていることがあるため、
    // 汎用的な既定値(5173)は避けてproject0827専用のポートに固定する。
    // strictPort: trueにより、万一ポートが使用中でも別ポートへ黙って
    // ずれることはなく、はっきりエラーで知らせる（意図しない別プロジェクトの
    // 画面が開いてしまう事故を防ぐ）。
    port: 5827,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8827',
        changeOrigin: true,
      },
    },
    // ngrok等のトンネルサービスが発行する動的ホスト名からのアクセスを許可する
    allowedHosts: true,
  },
  preview: {
    port: 5827,
    strictPort: true,
    // Railway等がデプロイ先に割り当てる動的ホスト名からのアクセスを許可する
    allowedHosts: true,
  },
})
