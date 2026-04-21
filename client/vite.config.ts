import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = (env.VITE_PROXY_API_TARGET || 'http://127.0.0.1:3000').replace(/\/$/, '');

  return {
    plugins: [react()],
    base: '/',
    build: {
      target: 'es2020',
    },
    server: {
      host: true, // 모바일에서 같은 Wi-Fi로 접속 가능
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('error', (err) => {
              console.error(`[Vite proxy /api → ${proxyTarget}]`, err.message);
              console.error(
                '→ API가 꺼져 있거나 PORT가 다르면 502입니다. 루트에서 npm run dev 로 서버+클라이언트를 함께 켜거나, client/.env 에 VITE_PROXY_API_TARGET=http://127.0.0.1:실제PORT 를 맞추세요.'
              );
            });
          },
        },
        '/ws': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
          configure(proxy) {
            proxy.on('error', (err) => {
              console.error(`[Vite proxy /ws → ${proxyTarget}]`, err.message);
            });
          },
        },
      },
    },
  };
});
