/**
 * SK클린텍 기본 테넌트의 admin·pyo 업무 계정 upsert.
 * seed 전체 없이 운영 로그인만 복구할 때 또는 preDeploy 보조용.
 *
 * 비밀번호:
 * - 신규 생성: TENANT_BOOTSTRAP_PASSWORD 또는 1234
 * - 기존 계정: ENSURE_TENANT_ADMIN_RESET_PASSWORD=true 일 때만 덮어씀
 *
 * 실행: cd server && npx tsx scripts/ensure-default-tenant-admins.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';

const bootstrapPassword = (process.env.TENANT_BOOTSTRAP_PASSWORD ?? '1234').trim() || '1234';
const resetExisting = process.env.ENSURE_TENANT_ADMIN_RESET_PASSWORD === 'true';

const prisma = new PrismaClient();

const accounts = [
  { email: 'admin', name: '관리자', isTenantOwner: true },
  { email: 'pyo', name: '표마왕', isTenantOwner: true },
] as const;

async function main() {
  const hash = await bcrypt.hash(bootstrapPassword, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    update: { name: 'SK클린텍', status: 'ACTIVE', plan: 'premium' },
    create: {
      id: DEFAULT_TENANT_ID,
      slug: DEFAULT_TENANT_SLUG,
      name: 'SK클린텍',
      status: 'ACTIVE',
      plan: 'premium',
    },
  });

  for (const acct of accounts) {
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: acct.email } },
      select: { id: true },
    });

    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: acct.email } },
      update: {
        ...(resetExisting || !existing ? { passwordHash: hash } : {}),
        isActive: true,
        role: 'ADMIN',
        name: acct.name,
        isTenantOwner: acct.isTenantOwner,
      },
      create: {
        tenantId: tenant.id,
        email: acct.email,
        passwordHash: hash,
        name: acct.name,
        role: 'ADMIN',
        isTenantOwner: acct.isTenantOwner,
      },
      select: { email: true, isActive: true, isTenantOwner: true },
    });

    const pwdNote = !existing || resetExisting ? `(비밀번호 ${resetExisting ? '재설정' : '신규'})` : '(비밀번호 유지)';
    console.log(
      `[ensure-default-tenant-admins] ${tenant.slug}/${user.email} owner=${user.isTenantOwner} ${pwdNote}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
