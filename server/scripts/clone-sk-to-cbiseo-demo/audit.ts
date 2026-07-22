import type { PrismaClient } from '@prisma/client';

/** cbiseo 테넌트에 실전화·실이메일 잔존 여부 간단 audit */
export async function auditTargetPii(
  prisma: PrismaClient,
  targetTenantId: string,
): Promise<{ ok: boolean; issues: string[] }> {
  const issues: string[] = [];
  const phoneRe = /01[016789]-?\d{3,4}-?\d{4}/;

  const inquiries = await prisma.inquiry.findMany({
    where: { tenantId: targetTenantId },
    select: {
      customerName: true,
      customerPhone: true,
      customerPhone2: true,
      customerEmail: true,
      address: true,
      memo: true,
    },
    take: 500,
  });

  for (const row of inquiries) {
    if (phoneRe.test(row.customerPhone) && !row.customerPhone.startsWith('010-0000-')) {
      issues.push(`접수 전화번호 의심: ${row.customerPhone}`);
    }
    if (row.customerEmail && !row.customerEmail.includes('example.cbiseo.local')) {
      issues.push(`접수 이메일 의심: ${row.customerEmail}`);
    }
    if (row.address && !row.address.includes('데모')) {
      issues.push(`주소 데모 미적용 의심: ${row.address.slice(0, 30)}`);
    }
  }

  const ext = await prisma.externalCompany.findMany({
    where: { tenantId: targetTenantId },
    select: { name: true, phone: true },
  });
  for (const e of ext) {
    if (!e.name.startsWith('데모협력사')) {
      issues.push(`타업체명 미가명: ${e.name}`);
    }
  }

  const members = await prisma.teamMember.findMany({
    where: { tenantId: targetTenantId },
    select: { name: true },
    take: 200,
  });
  for (const m of members) {
    if (!m.name.startsWith('팀원')) {
      issues.push(`팀원명 미가명: ${m.name}`);
    }
  }

  return { ok: issues.length === 0, issues: issues.slice(0, 20) };
}
