/**
 * 로컬 통합 개발(API + Vite) 재시작 전에 흔한 포트 점유를 해제합니다.
 * Windows: Get-NetTCPConnection + Stop-Process
 * 그 외: lsof + kill (있을 때만)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

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

const vitePorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179];
const apiPort = readApiPort();
const ports = [...new Set([apiPort, ...vitePorts])].sort((a, b) => a - b);

function killPortWindows(port) {
  const cmd = `
$p=${port}
Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
`.trim();
  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

function killPortUnix(port) {
  spawnSync('sh', ['-c', `lsof -ti tcp:${port} 2>/dev/null | xargs kill -9 2>/dev/null || true`], {
    stdio: 'pipe',
  });
}

console.info('[dev-restart] freeing ports:', ports.join(', '));
for (const port of ports) {
  if (os.platform() === 'win32') killPortWindows(port);
  else killPortUnix(port);
}
console.info('[dev-restart] done (listeners cleared where possible).');
