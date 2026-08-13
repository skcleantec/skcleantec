import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PLATFORM_BILLING_NOTIFY_GROUP_EMAIL, PLATFORM_SYSTEM_MAIL_FROM } from '../src/lib/platformWorkspace.constants.js';
import { notifyPaymentConfirmationRequestByEmail } from '../src/modules/billing/tenantBilling.paymentRequest.email.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dir, '../.env') });
dotenv.config({ path: path.join(dir, '../../.env') });

async function main() {
  const url = process.env.SKCT_TARGET_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const existing = await prisma.platformBillingSettings.findUnique({ where: { id: 'default' } });
    const row = await prisma.platformBillingSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        dunningPaymentNotifyEmail: PLATFORM_BILLING_NOTIFY_GROUP_EMAIL,
        smtpFrom: PLATFORM_SYSTEM_MAIL_FROM,
      },
      update: {
        dunningPaymentNotifyEmail: PLATFORM_BILLING_NOTIFY_GROUP_EMAIL,
        ...(!existing?.smtpFrom?.trim() ? { smtpFrom: PLATFORM_SYSTEM_MAIL_FROM } : {}),
      },
    });
    console.log('notify email saved:', row.dunningPaymentNotifyEmail);
    console.log('smtp from saved:', row.smtpFrom);

    const mail = await notifyPaymentConfirmationRequestByEmail({
      notifyEmail: PLATFORM_BILLING_NOTIFY_GROUP_EMAIL,
      tenantName: '연동 테스트 샘플 업체',
      tenantSlug: 'sample',
      tenantId: '00000000-0000-0000-0000-000000000001',
      invoiceId: '00000000-0000-0000-0000-000000000002',
      amountKrw: 200000,
      dueDate: new Date().toISOString(),
      invoiceStatus: 'ISSUED',
      requesterName: '시스템 연동 테스트',
      requesterEmail: PLATFORM_SYSTEM_MAIL_FROM,
    });
    console.log('test mail result:', mail);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
