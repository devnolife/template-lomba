import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor';
            if (id.includes('@emotion') || id.includes('@mui')) return 'mui';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts';
            if (id.includes('@tanstack') || id.includes('zustand') || id.includes('axios')) return 'query';
          }
        },
      },
    },
  },
});
