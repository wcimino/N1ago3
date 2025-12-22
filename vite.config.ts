import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  root: './client',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-toast', '@radix-ui/react-scroll-area', '@radix-ui/react-label', '@radix-ui/react-slot'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-utils': ['date-fns', 'date-fns-tz', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
  },
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/webhook': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
