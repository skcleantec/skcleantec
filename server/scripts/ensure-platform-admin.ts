/**
 * PlatformUser(플랫폼 /platform/login) upsert.
 *
 * - `pyo` 는 항상 보장 (PLATFORM_ADMIN_EMAIL 이 다른 값이어도)
 * - PLATFORM_ADMIN_EMAIL 이 있으면 해당 아이디도 추가 upsert
 *
 * 비밀번호:
 * - 신규 생성: PLATFORM_ADMIN_PASSWORD 또는 1234
 * - 기존 계정: ENSURE_PLATFORM_ADMIN_RESET_PASSWORD=true 일 때만 덮어씀
 *
 * 실행: cd server && npx tsx scripts/ensure-platform-admin.ts
 */
import '../src/env.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const DEFAULT_PLATFORM_LOGIN_ID = 'pyo';
const password = (process.env.PLATFORM_ADMIN_PASSWORD ?? '1234').trim() || '1234';
const resetExisting = process.env.ENSURE_PLATFORM_ADMIN_RESET_PASSWORD === 'true';

function bootstrapLoginIds(): string[] {
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const ids = new Set<string>([DEFAULT_PLATFORM_LOGIN_ID]);
  if (fromEnv) ids.add(fromEnv);
  return [...ids];
}

async function ensurePlatformUser(email: string, hash: string): Promise<void> {
  const existing = await prisma.platformUser.findUnique({
    where: { email },
    select: { id: true },
  });

  const user = await prisma.platformUser.upsert({
    where: { email },
    update: {
      ...(resetExisting || !existing ? { passwordHash: hash } : {}),
      isActive: true,
      name: '청소비서 관리자',
      role: 'SUPER_ADMIN',
    },
    create: {
      email,
      passwordHash: hash,
      name: '청소비서 관리자',
      role: 'SUPER_ADMIN',
    },
    select: { id: true, email: true, role: true },
  });

  const pwdNote = !existing || resetExisting ? `(비밀번호 ${resetExisting ? '재설정' : '신규'})` : '(비밀번호 유지)';
  console.log(`[ensure-platform-admin] ${user.email} (${user.role}) ${pwdNote}`);
}

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const ids = bootstrapLoginIds();
  console.log(`[ensure-platform-admin] 대상 아이디: ${ids.join(', ')}`);

  for (const email of ids) {
    await ensurePlatformUser(email, hash);
  }

  const all = await prisma.platformUser.findMany({
    select: { email: true, isActive: true, role: true },
    orderBy: { email: 'asc' },
  });
  console.log(`[ensure-platform-admin] platform_users ${all.length}건:`, all);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
