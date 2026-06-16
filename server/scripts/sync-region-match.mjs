/**
 * shared/regionMatch.ts → server/src/lib/regionMatch.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const src = path.join(repoRoot, 'shared', 'regionMatch.ts');
const dest = path.join(serverRoot, 'src', 'lib', 'regionMatch.ts');

const banner = `/**
 * @generated-sync from shared/regionMatch.ts — 직접 수정하지 마세요.
 * 변경: shared/regionMatch.ts 수정 후 \`npm run sync:region-match\` (prebuild/predev 자동).
 */

`;

const body = fs.readFileSync(src, 'utf8');
const stripped = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, banner + stripped, 'utf8');
console.info('[sync-region-match]', path.relative(repoRoot, dest));
