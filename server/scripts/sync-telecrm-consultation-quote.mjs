/**
 * shared/telecrmConsultationQuote.ts → server/src/lib/telecrmConsultationQuote.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const src = path.join(repoRoot, 'shared', 'telecrmConsultationQuote.ts');
const dest = path.join(serverRoot, 'src', 'lib', 'telecrmConsultationQuote.ts');

const banner = `/**
 * @generated-sync from shared/telecrmConsultationQuote.ts — 직접 수정하지 마세요.
 * 변경: shared/telecrmConsultationQuote.ts 수정 후 \`npm run sync:telecrm-consultation-quote\`.
 */

`;

const body = fs.readFileSync(src, 'utf8');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, banner + body, 'utf8');
console.info('[sync-telecrm-consultation-quote]', path.relative(repoRoot, dest));
