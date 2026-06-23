import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** `scripts/dev-wait-client.mjs` 와 동일 — `VITE_PROXY_API_TARGET` 미설정 시 server/.env 의 PORT 사용 */
function readApiPortFromRepoEnv(): number {
  const clientDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.join(clientDir, '..');
  for (const rel of ['server/.env', '.env']) {
    const fp = path.join(root, rel);
    if (!fs.existsSync(fp)) continue;
    const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*PORT\s*=\s*(\d+)\s*$/);
      if (m) return parseInt(m[1], 10);
    }
  }
  return 3000;
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const fromEnv = env.VITE_PROXY_API_TARGET?.trim();
  const port = readApiPortFromRepoEnv();
  /** 개발 서버: Cursor 등에서 상대 `/api` 가 실패할 때 쓰는 절대 API 베이스(항상 `/api` 포함) */
  const devInternalApiBase = mode === 'development' ? `http://127.0.0.1:${port}/api` : '';
  const proxyTarget = (
    fromEnv && fromEnv.length > 0 ? fromEnv : `http://127.0.0.1:${port}`
  )
    .replace(/\/$/, '')
    .replace(/\/api$/i, '');

  if (command === 'serve') {
    console.info(`[vite] dev proxy /api, /ws → ${proxyTarget}`);
  }

  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

  return {
    define: {
      'import.meta.env.VITE_INTERNAL_API_BASE': JSON.stringify(devInternalApiBase),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': path.join(repoRoot, 'shared'),
      },
      /** shared/ 에 .js·.ts 공존 시 stale CJS .js 가 우선되지 않도록 */
      extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
    },
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
                '→ API가 꺼져 있거나 PORT 불일치면 502입니다. 루트에서 npm run dev 로 함께 켜거나, server/.env 의 PORT 와 맞게 client/.env 에 VITE_PROXY_API_TARGET=http://127.0.0.1:PORT 를 두세요.'
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
