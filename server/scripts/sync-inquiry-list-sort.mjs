/**
 * shared/inquiryListSort.ts → server/src/lib/inquiryListSort.ts
 * prebuild/predev 에서 실행 — tier 정렬 단일 소스 유지(ESM은 server 패키지 내부에서만 컴파일).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const src = path.join(repoRoot, 'shared', 'inquiryListSort.ts');
const dest = path.join(serverRoot, 'src', 'lib', 'inquiryListSort.ts');

const banner = `/**
 * @generated-sync from shared/inquiryListSort.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryListSort.ts 수정 후 \`npm run sync:inquiry-list-sort\` (prebuild/predev 자동).
 */

`;

const body = fs.readFileSync(src, 'utf8');
const stripped = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, banner + stripped, 'utf8');
console.info('[sync-inquiry-list-sort]', path.relative(repoRoot, dest));
