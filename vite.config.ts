import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react', 'sip.js'],
    esbuildOptions: {
      target: 'esnext', // Ensure modern ES module support
    },
  },
  server: {
    https: false, // Disable HTTPS for development
    hmr: {
      protocol: 'ws',
    },
  },
});
