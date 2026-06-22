import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/events': 'http://localhost:8080',
      '/target.pdf': 'http://localhost:8080'
    }
  }
});
