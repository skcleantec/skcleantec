/**
 * 접수번호 backfill — Docker(production)는 dist JS, 로컬은 tsx fallback.
 * Railway preDeploy·스테이징 DB 가져오기 후처리에서 사용.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const distEntry = join(serverRoot, 'dist/jobs/backfillInquiryNumbers.js');

function exitWith(child) {
  process.exit(child.status ?? 1);
}

if (existsSync(distEntry)) {
  exitWith(spawnSync('node', [distEntry], { cwd: serverRoot, stdio: 'inherit' }));
}

const tsxEntry = join(serverRoot, 'src/jobs/backfillInquiryNumbers.ts');
if (existsSync(tsxEntry)) {
  exitWith(
    spawnSync('npx', ['tsx', 'src/jobs/backfillInquiryNumbers.ts'], {
      cwd: serverRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }),
  );
}

console.error('backfill-inquiry-numbers: dist 또는 src 진입점을 찾을 수 없습니다.');
process.exit(1);
