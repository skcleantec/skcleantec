import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dir, '../.env') });

const prisma = new PrismaClient();

function kstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { slug: 'asc' },
  });
  console.log('=== Tenants ===');
  for (const t of tenants) console.log(`${t.slug}\t${t.name}\t${t.id}`);

  const sk = tenants.find((t) => t.slug === 'sk' || t.slug === 'skcleanteck');
  const cbiseo = tenants.find((t) => t.slug === 'cbiseo');
  if (!sk) {
    console.log('SK tenant not found');
    return;
  }

  const ocs = await prisma.operatingCompany.findMany({
    where: { tenantId: sk.id },
    select: { id: true, slug: true, name: true },
  });
  console.log('\n=== SK OperatingCompanies ===');
  for (const oc of ocs) console.log(`${oc.slug}\t${oc.name}`);

  const tana = ocs.find((oc) => oc.slug.includes('tana') || oc.name.includes('타나'));
  const skOcIds = ocs.filter((oc) => oc.id !== tana?.id).map((oc) => oc.id);

  const rollingFrom = kstNow();
  rollingFrom.setDate(rollingFrom.getDate() - 30);

  const inqCount = await prisma.inquiry.count({
    where: {
      tenantId: sk.id,
      operatingCompanyId: { in: skOcIds },
      createdAt: { gte: rollingFrom },
    },
  });
  const inqWithTana = tana
    ? await prisma.inquiry.count({
        where: {
          tenantId: sk.id,
          operatingCompanyId: tana.id,
          createdAt: { gte: rollingFrom },
        },
      })
    : 0;

  const orderForms = await prisma.orderForm.count({
    where: {
      tenantId: sk.id,
      operatingCompanyId: { in: skOcIds },
      createdAt: { gte: rollingFrom },
    },
  });

  const adSessions = await prisma.adWorkSession.count({
    where: { tenantId: sk.id, startedAt: { gte: rollingFrom } },
  });

  const payrollTeam = await prisma.teamMemberPayrollSettlement.count({
    where: { teamMember: { tenantId: sk.id }, settledAt: { gte: rollingFrom } },
  });

  const eContracts = await prisma.eContractIssuance.count({
    where: {
      definition: { tenantId: sk.id },
      updatedAt: { gte: rollingFrom },
    },
  });

  console.log('\n=== Last 30 days KST rolling (excl tanaclean brand) ===');
  console.log('from:', rollingFrom.toISOString());
  console.log('inquiries:', inqCount);
  console.log('orderForms:', orderForms);
  console.log('tanaclean inquiries (excluded):', inqWithTana);
  console.log('adWorkSessions:', adSessions);
  console.log('teamPayrollSettlements:', payrollTeam);
  console.log('eContractIssuances:', eContracts);

  if (cbiseo) {
    console.log('\n=== cbiseo existing (all time) ===');
    console.log('inquiries:', await prisma.inquiry.count({ where: { tenantId: cbiseo.id } }));
    console.log('users:', await prisma.user.count({ where: { tenantId: cbiseo.id } }));
  }

  console.log('\n=== SK master (all time) ===');
  console.log('externalCompanies:', await prisma.externalCompany.count({ where: { tenantId: sk.id } }));
  console.log('teamMembers:', await prisma.teamMember.count({ where: { tenantId: sk.id } }));
  console.log('teams:', await prisma.team.count({ where: { tenantId: sk.id } }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
