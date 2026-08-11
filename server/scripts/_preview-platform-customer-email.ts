import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OutboundEmailPurpose } from '../src/lib/outboundEmailPurpose.js';
import { buildPlatformEmailTemplatePreview } from '../src/modules/platform-email-templates/platformEmailTemplatePreview.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../../client/public/email-previews');

const PURPOSES: OutboundEmailPurpose[] = ['ORDER_FORM_SUBMISSION', 'INSPECTION_COMPLETION'];

mkdirSync(outDir, { recursive: true });

for (const purpose of PURPOSES) {
  const { html, subject } = await buildPlatformEmailTemplatePreview({ purpose });
  const fileName = purpose === 'ORDER_FORM_SUBMISSION' ? 'order-form.html' : 'inspection.html';
  writeFileSync(join(outDir, fileName), html, 'utf8');
  console.log(`Wrote ${fileName} — ${subject}`);
}

console.log('\nOpen in browser:');
console.log('  http://localhost:5173/email-previews/order-form.html');
console.log('  http://localhost:5173/email-previews/inspection.html');
