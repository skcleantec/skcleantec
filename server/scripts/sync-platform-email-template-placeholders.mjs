/**
 * shared/platformEmailTemplatePlaceholders.ts → server/src/lib/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const name = 'platformEmailTemplatePlaceholders.ts';
const src = path.join(repoRoot, 'shared', name);
const dest = path.join(serverRoot, 'src', 'lib', name);
const body = fs.readFileSync(src, 'utf8');
const stripped = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '');
const banner = `/**
 * @generated-sync from shared/${name} — 직접 수정하지 마세요.
 */

`;
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, banner + stripped, 'utf8');
console.info('[sync-platform-email-template-placeholders]', path.relative(repoRoot, dest));
