/**
 * PlatformUser(플랫폼 최상위) upsert — seed 전체 없이 계정만 맞출 때
 * 실행: cd server && npx tsx scripts/ensure-platform-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const email = (process.env.PLATFORM_ADMIN_EMAIL ?? 'pyo').trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? '1234';

const prisma = new PrismaClient();

const hash = await bcrypt.hash(password, 10);
const user = await prisma.platformUser.upsert({
  where: { email },
  update: {
    passwordHash: hash,
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

console.log(`[ensure-platform-admin] ${user.email} (${user.role}) — 비밀번호 반영됨`);

await prisma.$disconnect();
