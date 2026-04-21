/**
 * 루트 `npm run dev`에서 API가 뜬 뒤 Vite를 켭니다.
 * 서버가 늦게 올라올 때 브라우저가 먼저 /api 를 치면 Vite 프록시가 502를 내는 것을 줄입니다.
 */
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readApiPort() {
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

const port = readApiPort();
let base =
  (process.env.VITE_PROXY_API_TARGET && String(process.env.VITE_PROXY_API_TARGET).trim()) ||
  `http://127.0.0.1:${port}`;
base = base.replace(/\/$/, '').replace(/\/api$/i, '');
const healthUrl = `${base}/api/health`;

const wait = spawnSync('npx', ['wait-on', '-t', '120000', healthUrl], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
});
if (wait.status !== 0) {
  console.error(
    `[dev-wait-client] ${healthUrl} 응답을 기다리다 중단했습니다. DB·PORT·server/.env 를 확인한 뒤 API만 먼저 켜 보세요: npm run dev:server`
  );
  process.exit(wait.status ?? 1);
}

const child = spawn('npm', ['run', 'dev:vite', '--prefix', path.join(root, 'client')], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: { ...process.env, VITE_PROXY_API_TARGET: base },
});
child.on('exit', (code) => process.exit(code ?? 0));
