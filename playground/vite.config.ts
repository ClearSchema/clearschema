import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      'fs/promises': '/dev/null',
      fs: '/dev/null',
      path: '/dev/null',
    },
  },
});
