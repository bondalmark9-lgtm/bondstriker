import { defineConfig, loadEnv } from 'vite';

export default defineConfig(function ({ mode }) {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '3001';

  return {
    server: {
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:' + apiPort,
          changeOrigin: true
        }
      }
    }
  };
});
