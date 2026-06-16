/**
 * shared/tenantHost.ts → server/src/lib/tenantHost.ts
 * prebuild/predev 에서 실행 — Host→slug 규칙 단일 소스 유지.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const src = path.join(repoRoot, 'shared', 'tenantHost.ts');
const dest = path.join(serverRoot, 'src', 'lib', 'tenantHost.ts');

const banner = `/**
 * @generated-sync from shared/tenantHost.ts — 직접 수정하지 마세요.
 * 변경: shared/tenantHost.ts 수정 후 \`npm run sync:tenant-host\` (prebuild/predev 자동).
 */

`;

let body = fs.readFileSync(src, 'utf8');
body = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '');
body = body.replace(
  /from '\.\/tenantFeatureModules\.js'/,
  "from '../modules/tenants/tenant.constants.js'",
);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, banner + body, 'utf8');
console.info('[sync-tenant-host]', path.relative(repoRoot, dest));
