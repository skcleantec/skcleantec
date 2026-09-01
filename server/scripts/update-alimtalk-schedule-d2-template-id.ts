import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { DEFAULT_SOLAPI_TEMPLATE_IDS } from '../src/modules/alimtalk/alimtalkSolapi.client.js';
import { ensureAlimtalkPlatformTemplates } from '../src/modules/alimtalk/alimtalkWallet.service.js';

const CODE = 'CBISEO_CUST_SCHEDULE_D2';
const NEXT = DEFAULT_SOLAPI_TEMPLATE_IDS[CODE];

async function main() {
  await ensureAlimtalkPlatformTemplates();
  const row = await prisma.alimtalkTemplate.findUnique({
    where: { code: CODE },
    select: { code: true, solapiTemplateId: true, isActive: true, name: true },
  });
  console.log('AlimtalkTemplate', CODE, row);
  if (row && row.solapiTemplateId !== NEXT) {
    const updated = await prisma.alimtalkTemplate.update({
      where: { code: CODE },
      data: { solapiTemplateId: NEXT, isActive: true },
      select: { solapiTemplateId: true },
    });
    console.log('updated solapiTemplateId ->', updated.solapiTemplateId);
  } else if (row) {
    console.log('already current');
  }
}

main().finally(() => prisma.$disconnect());
