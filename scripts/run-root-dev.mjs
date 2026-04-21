/**
 * `client` 폴더에서 `npm run dev` 시에도 루트와 동일하게 API+Vite 를 함께 띄웁니다.
 * (호출 cwd 와 무관하게 저장소 루트에서 `npm run dev` 실행)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync('npm', ['run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(r.status ?? 1);
