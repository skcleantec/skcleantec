import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import {
  platformSupportShadowEmail,
  PLATFORM_SUPPORT_USER_WHERE,
} from './tenantSupportAccess.constants.js';

export type TenantSupportAccessRow = {
  id: string;
  loginId: string;
  name: string;
  memo: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toRow(row: {
  id: string;
  loginId: string;
  name: string;
  memo: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TenantSupportAccessRow {
  return {
    id: row.id,
    loginId: row.loginId,
    name: row.name,
    memo: row.memo,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function suggestSupportAccessLoginId(): string {
  return `ops-${randomBytes(4).toString('hex')}`;
}

export function suggestSupportAccessPassword(): string {
  return randomBytes(6).toString('base64url');
}

export async function listTenantSupportAccessForPlatform(): Promise<TenantSupportAccessRow[]> {
  const rows = await prisma.tenantSupportAccess.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toRow);
}

export async function createTenantSupportAccessForPlatform(data: {
  loginId: string;
  password: string;
  name?: string;
  memo?: string;
}): Promise<{ account: TenantSupportAccessRow; initialPassword: string }> {
  const loginId = assertValidTenantLoginId(data.loginId);
  const password = data.password.trim() || suggestSupportAccessPassword();
  if (password.length < 4) throw new Error('비밀번호는 4자 이상 입력해주세요.');
  const name = (data.name?.trim() || '플랫폼 지원').slice(0, 64);
  const memo = data.memo?.trim() ? data.memo.trim().slice(0, 2000) : null;

  const taken = await prisma.tenantSupportAccess.findUnique({ where: { loginId } });
  if (taken) throw new Error('이미 사용 중인 지원 접속 아이디입니다.');

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.tenantSupportAccess.create({
    data: { loginId, passwordHash, name, memo },
  });
  return { account: toRow(created), initialPassword: password };
}

export async function updateTenantSupportAccessForPlatform(
  id: string,
  data: {
    loginId?: string;
    password?: string;
    name?: string;
    memo?: string | null;
    isActive?: boolean;
  },
): Promise<TenantSupportAccessRow> {
  const existing = await prisma.tenantSupportAccess.findUnique({ where: { id } });
  if (!existing) throw new Error('지원 접속 계정을 찾을 수 없습니다.');

  const patch: {
    loginId?: string;
    passwordHash?: string;
    name?: string;
    memo?: string | null;
    isActive?: boolean;
  } = {};

  if (data.loginId !== undefined) {
    const loginId = assertValidTenantLoginId(data.loginId);
    if (loginId !== existing.loginId) {
      const taken = await prisma.tenantSupportAccess.findUnique({ where: { loginId } });
      if (taken) throw new Error('이미 사용 중인 지원 접속 아이디입니다.');
      patch.loginId = loginId;
    }
  }

  if (data.name !== undefined) {
    const name = data.name.trim().slice(0, 64);
    if (!name) throw new Error('표시 이름을 입력해주세요.');
    patch.name = name;
  }

  if (data.memo !== undefined) {
    patch.memo = data.memo?.trim() ? data.memo.trim().slice(0, 2000) : null;
  }

  if (data.password !== undefined && data.password.trim()) {
    patch.passwordHash = await bcrypt.hash(data.password.trim(), 10);
  }

  if (data.isActive !== undefined) {
    patch.isActive = data.isActive;
  }

  const updated =
    Object.keys(patch).length === 0
      ? existing
      : await prisma.tenantSupportAccess.update({ where: { id }, data: patch });

  if (patch.isActive === false || patch.passwordHash || patch.name) {
    await prisma.user.updateMany({
      where: { platformSupportAccessId: id },
      data: {
        ...(patch.isActive === false ? { isActive: false } : {}),
        ...(patch.passwordHash ? { passwordHash: patch.passwordHash } : {}),
        ...(patch.name ? { name: patch.name } : {}),
      },
    });
  }

  return toRow(updated);
}

export async function findActiveTenantSupportAccess(loginId: string) {
  return prisma.tenantSupportAccess.findFirst({
    where: { loginId, isActive: true },
  });
}

/** 지원 계정 로그인 시 테넌트에 shadow ADMIN 생성·동기화 */
export async function ensureSupportShadowUser(
  support: { id: string; name: string; passwordHash: string; isActive: boolean },
  tenantId: string,
) {
  const email = platformSupportShadowEmail(support.id);
  const existing = await prisma.user.findFirst({
    where: { tenantId, platformSupportAccessId: support.id },
  });
  if (existing) {
    if (!existing.isActive && support.isActive) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { isActive: true, name: support.name, passwordHash: support.passwordHash },
      });
    }
    if (existing.name !== support.name || existing.passwordHash !== support.passwordHash) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { name: support.name, passwordHash: support.passwordHash },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash: support.passwordHash,
      name: support.name,
      role: 'ADMIN',
      isTenantOwner: true,
      isActive: support.isActive,
      platformSupportAccessId: support.id,
    },
  });
}

export async function touchTenantSupportAccessLastUsed(id: string) {
  await prisma.tenantSupportAccess.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

export { PLATFORM_SUPPORT_USER_WHERE };
