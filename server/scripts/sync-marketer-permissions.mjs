/**
 * shared/marketerPermissions.ts → server/src/lib/marketerPermissions.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const src = path.join(repoRoot, 'shared', 'marketerPermissions.ts');
const dest = path.join(serverRoot, 'src', 'lib', 'marketerPermissions.ts');

const banner = `/**
 * @generated-sync from shared/marketerPermissions.ts — 직접 수정하지 마세요.
 * 변경: shared/marketerPermissions.ts 수정 후 \`npm run sync:marketer-permissions\` (prebuild/predev 자동).
 */

`;

const body = fs.readFileSync(src, 'utf8');
const stripped = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '').replace(/^import type \{ MarketerAdminLevel \} from '\.\/marketerAdminLevel\.js';?\s*\n/, "import type { MarketerAdminLevel } from './marketerAdminLevel.js';\n");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, banner + stripped, 'utf8');
console.info('[sync-marketer-permissions]', path.relative(repoRoot, dest));
