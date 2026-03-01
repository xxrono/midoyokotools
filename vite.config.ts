import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // これを追加することでGitHub Pagesなどどこに配置しても動くようになります
})
