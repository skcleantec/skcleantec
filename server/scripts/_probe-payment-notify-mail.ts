import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dir, '../.env') });

import { prisma } from '../src/lib/prisma.js';
import { resolvePlatformSmtpTransport, isPlatformSmtpConfigured } from '../src/lib/platformSmtp.service.js';
import { isGlobalSmtpConfigured } from '../src/lib/tenantSmtp.service.js';
import { resolvePlatformBillingNotifyEmail } from '../src/lib/platformWorkspace.constants.js';

async function main() {
  const billing = await prisma.platformBillingSettings.findUnique({ where: { id: 'default' } });
  console.log('=== notify ===');
  console.log('stored:', billing?.dunningPaymentNotifyEmail ?? null);
  console.log('resolved:', resolvePlatformBillingNotifyEmail(billing?.dunningPaymentNotifyEmail));

  console.log('\n=== smtp db row ===');
  console.log(
    JSON.stringify(
      {
        smtpHost: billing?.smtpHost,
        smtpPort: billing?.smtpPort,
        smtpSecure: billing?.smtpSecure,
        smtpUser: billing?.smtpUser,
        smtpFrom: billing?.smtpFrom,
        passEncLen: billing?.smtpPassEnc?.length ?? 0,
        updatedAt: billing?.updatedAt?.toISOString(),
      },
      null,
      2,
    ),
  );

  console.log('\n=== env fallback ===');
  console.log('globalSmtpConfigured:', isGlobalSmtpConfigured());
  console.log('SMTP_HOST:', process.env.SMTP_HOST?.trim() || '(unset)');
  console.log('SMTP_USER:', process.env.SMTP_USER?.trim() || '(unset)');
  console.log('SMTP_FROM:', process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || '(unset)');
  console.log('SMTP_PASS set:', Boolean(process.env.SMTP_PASS?.trim()));

  console.log('\n=== effective transport ===');
  console.log('isPlatformSmtpConfigured:', await isPlatformSmtpConfigured());
  const transport = await resolvePlatformSmtpTransport();
  if (!transport) {
    console.log('transport: NULL (cannot send)');
    return;
  }
  console.log('source:', transport.source);
  console.log('host:', transport.host);
  console.log('authUser:', transport.auth?.user ?? null);
  console.log('from (raw):', transport.from);
  console.log('pass configured:', Boolean(transport.auth?.pass));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
