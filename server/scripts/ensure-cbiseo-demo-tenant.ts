/**
 * 스테이징·운영 cbiseo 교육 테넌트가 없을 때 최소 프로비저닝
 * 실행: DATABASE_URL=<staging> npx tsx scripts/ensure-cbiseo-demo-tenant.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { provisionTenant } from '../src/modules/platform/tenantProvisioning.service.js';
import { ensureGuideDemoStaffUsers } from './guide-demo/tenantScope.js';

async function main() {
  const existing = await prisma.tenant.findFirst({
    where: { slug: 'cbiseo' },
    select: { id: true, slug: true, name: true, plan: true },
  });

  let tenantId: string;
  if (existing) {
    console.info(`[ensure-cbiseo] 기존 테넌트: ${existing.slug} (${existing.name}) plan=${existing.plan}`);
    tenantId = existing.id;
    if (existing.plan !== 'premium') {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plan: 'premium', status: 'ACTIVE' },
      });
      console.info('[ensure-cbiseo] plan → premium');
    }
  } else {
    const { tenant } = await provisionTenant({
      slug: 'cbiseo',
      name: '청소비서 교육데모',
      plan: 'premium',
      adminLoginId: 'admin',
      adminPassword: '1234',
      adminName: '데모관리자',
      status: 'ACTIVE',
    });
    tenantId = tenant.id;
    console.info(`[ensure-cbiseo] 신규 생성: ${tenant.slug} (${tenant.id})`);
  }

  const hash = await bcrypt.hash('1234', 10);
  const extraUsers = [
    { email: 'cbiseo', role: 'ADMIN' as const, name: '데모관리자(cbiseo)' },
    { email: 'cbiseo-team', role: 'TEAM_LEADER' as const, name: '데모팀장' },
  ];
  for (const u of extraUsers) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: u.email } },
      update: { isActive: true, role: u.role, name: u.name },
      create: {
        tenantId,
        email: u.email,
        passwordHash: hash,
        role: u.role,
        name: u.name,
        isActive: true,
        profileCompletedAt: new Date(),
      },
    });
    console.info(`[ensure-cbiseo] user ${u.email} (${u.role})`);
  }

  await ensureGuideDemoStaffUsers(prisma, tenantId, '1234');
  console.info('[ensure-cbiseo] 데모 스태프 계정 보강 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
