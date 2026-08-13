/**
 * shared/outboundEmailPurpose.ts → server/src/lib/
 * prebuild/predev 에서 실행 — SMTP purpose 단일 소스 유지.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(here, '..');
const repoRoot = path.join(serverRoot, '..');
const files = ['outboundEmailPurpose.ts', 'platformSmtpProfileSlugs.ts'];

for (const name of files) {
  const src = path.join(repoRoot, 'shared', name);
  const dest = path.join(serverRoot, 'src', 'lib', name);
  const body = fs.readFileSync(src, 'utf8');
  const stripped = body.replace(/^\/\*\*[\s\S]*?\*\/\s*\n/, '');
  const banner = `/**
 * @generated-sync from shared/${name} — 직접 수정하지 마세요.
 * 변경: shared/${name} 수정 후 \`npm run sync:outbound-email-purpose\` (prebuild/predev 자동).
 */

`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, banner + stripped, 'utf8');
  console.info('[sync-outbound-email-purpose]', path.relative(repoRoot, dest));
}
