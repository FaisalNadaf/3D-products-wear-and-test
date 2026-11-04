import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  server: { port: 5173, host: true },
});
