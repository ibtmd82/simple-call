import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  optimizeDeps: {
    exclude: ['lucide-react', 'sip.js'],
    esbuildOptions: {
      target: 'esnext', // Ensure modern ES module support
    },
  },
  server: {
    https: true, // Enable HTTPS with auto-generated self-signed certificate
    hmr: {
      protocol: 'wss',
    },
  },
});
