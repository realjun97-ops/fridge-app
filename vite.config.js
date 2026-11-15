import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // supabase-js 번들 크기로 경고가 뜨지 않도록 한도를 조정합니다.
    chunkSizeWarningLimit: 1200,
  },
})
