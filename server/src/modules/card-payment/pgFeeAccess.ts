import { prisma } from '../../lib/prisma.js';
import { compareUserPasswordHash } from '../../lib/userPassword.js';

/** 플랫폼 로그인 중 수수료 수정·가맹 삭제를 할 수 있는 사람. */
export function isPyoPlatformUser(user: { email: string; name: string }): boolean {
  const local = user.email.trim().toLowerCase().split('@')[0] ?? '';
  const name = user.name.trim().toLowerCase();
  return local === 'pyo' || local.startsWith('pyo') || name === 'pyo';
}

export async function platformUserCanManagePgFees(platformUserId: string): Promise<boolean> {
  const user = await prisma.platformUser.findUnique({
    where: { id: platformUserId },
    select: { email: true, name: true },
  });
  return Boolean(user && isPyoPlatformUser(user));
}

export async function verifyPyoPassword(
  platformUserId: string,
  password: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const user = await prisma.platformUser.findUnique({
    where: { id: platformUserId },
    select: { email: true, name: true, passwordHash: true },
  });
  if (!user || !isPyoPlatformUser(user)) {
    return { error: '가맹점 삭제는 pyo만 할 수 있습니다.', status: 403 };
  }
  const matched = await compareUserPasswordHash(user.passwordHash, password);
  if (!matched) return { error: '비밀번호가 맞지 않습니다.', status: 401 };
  return { ok: true };
}
