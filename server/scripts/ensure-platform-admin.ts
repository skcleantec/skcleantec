/**
 * PlatformUser(플랫폼 /platform/login) upsert.
 *
 * 비밀번호:
 * - 신규 생성: PLATFORM_ADMIN_PASSWORD 또는 1234
 * - 기존 계정: ENSURE_PLATFORM_ADMIN_RESET_PASSWORD=true 일 때만 덮어씀
 *
 * 실행: cd server && npx tsx scripts/ensure-platform-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const email = (process.env.PLATFORM_ADMIN_EMAIL ?? 'pyo').trim().toLowerCase();
const password = (process.env.PLATFORM_ADMIN_PASSWORD ?? '1234').trim() || '1234';
const resetExisting = process.env.ENSURE_PLATFORM_ADMIN_RESET_PASSWORD === 'true';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash(password, 10);
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

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
