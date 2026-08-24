/**
 * sk 테넌트 푸시·스테이징 테스트용 팀장 계정 `pyo2` upsert.
 *
 * 실행: cd server && npx tsx scripts/ensure-pyo2-team-leader.ts
 * 비밀번호: TENANT_BOOTSTRAP_PASSWORD 또는 1234
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG, LEGACY_SK_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';

const bootstrapPassword = (process.env.TENANT_BOOTSTRAP_PASSWORD ?? '1234').trim() || '1234';
const resetExisting = process.env.ENSURE_TENANT_ADMIN_RESET_PASSWORD === 'true';

const prisma = new PrismaClient();

async function resolveSkTenant() {
  return (
    (await prisma.tenant.findUnique({
      where: { slug: DEFAULT_TENANT_SLUG },
      select: { id: true, slug: true },
    })) ??
    (await prisma.tenant.findUnique({
      where: { slug: LEGACY_SK_TENANT_SLUG },
      select: { id: true, slug: true },
    })) ??
    (await prisma.tenant.findUnique({
      where: { id: DEFAULT_TENANT_ID },
      select: { id: true, slug: true },
    }))
  );
}

async function main() {
  const tenant = await resolveSkTenant();
  if (!tenant) {
    throw new Error(
      `SK tenant not found (tried slug "${DEFAULT_TENANT_SLUG}", "${LEGACY_SK_TENANT_SLUG}", id ${DEFAULT_TENANT_ID}).`,
    );
  }

  const hash = await bcrypt.hash(bootstrapPassword, 10);
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: 'pyo2' } },
    select: { id: true },
  });

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'pyo2' } },
    update: {
      ...(resetExisting || !existing ? { passwordHash: hash } : {}),
      name: '푸시테스트팀장',
      role: 'TEAM_LEADER',
      isActive: true,
      isTenantOwner: false,
    },
    create: {
      tenantId: tenant.id,
      email: 'pyo2',
      passwordHash: hash,
      name: '푸시테스트팀장',
      role: 'TEAM_LEADER',
      isActive: true,
      isTenantOwner: false,
    },
    select: { email: true, role: true, isActive: true },
  });

  const pwdNote = !existing || resetExisting ? `(비밀번호 ${resetExisting ? '재설정' : '신규'})` : '(비밀번호 유지)';
  console.log(
    `[ensure-pyo2-team-leader] ${tenant.slug}/${user.email} role=${user.role} active=${user.isActive} ${pwdNote}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
