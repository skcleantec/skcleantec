import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';

const DEFAULT_PLATFORM_LOGIN_ID = 'pyo';

/** preDeploy 실패·구 배포 DB 등 — /platform/login bootstrap 계정이 없으면 기동 시 생성 */
export async function ensurePlatformBootstrapUsers(prisma: PrismaClient): Promise<void> {
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAIL ?? '').trim().toLowerCase();
  const ids = [...new Set<string>([DEFAULT_PLATFORM_LOGIN_ID, ...(fromEnv ? [fromEnv] : [])])];
  const password = (process.env.PLATFORM_ADMIN_PASSWORD ?? '1234').trim() || '1234';
  const resetExisting = process.env.ENSURE_PLATFORM_ADMIN_RESET_PASSWORD === 'true';

  for (const email of ids) {
    const existing = await prisma.platformUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing && !resetExisting) {
      continue;
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.platformUser.upsert({
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
    });

    if (!existing) {
      console.log(`[platform-bootstrap] PlatformUser '${email}' 생성 (비밀번호: env 또는 1234)`);
    } else if (resetExisting) {
      console.log(`[platform-bootstrap] PlatformUser '${email}' 비밀번호 재설정`);
    }
  }
}
