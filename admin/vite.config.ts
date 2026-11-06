import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '^/.*\\.(?:jpg|jpeg|png|gif|webp|svg)$': {
        target: 'http://127.0.0.1:8000/media/images',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => '/' + path.split('/').pop(),
      },
    },
  },
});
