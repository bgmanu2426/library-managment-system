import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: ['localhost', '.azurewebsites.net'],
    hmr: {
      overlay: true,
    },
  },
  clearScreen: false,
  define: {
    'process.env': process.env,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
