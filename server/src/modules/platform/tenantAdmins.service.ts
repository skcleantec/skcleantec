import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import { PLATFORM_SUPPORT_USER_WHERE } from './tenantSupportAccess.constants.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';

export type PlatformTenantAdmin = {
  id: string;
  loginId: string;
  name: string;
  isActive: boolean;
  isTenantOwner: boolean;
  createdAt: string;
};

function toPlatformTenantAdmin(row: {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isTenantOwner: boolean;
  createdAt: Date;
}): PlatformTenantAdmin {
  return {
    id: row.id,
    loginId: row.email,
    name: row.name,
    isActive: row.isActive,
    isTenantOwner: row.isTenantOwner,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertTenantExists(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw new TenantNotFoundError();
}

export async function listTenantAdminsForPlatform(tenantId: string): Promise<PlatformTenantAdmin[]> {
  await assertTenantExists(tenantId);
  const rows = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', ...PLATFORM_SUPPORT_USER_WHERE },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isTenantOwner: true,
      createdAt: true,
    },
    orderBy: [{ isTenantOwner: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(toPlatformTenantAdmin);
}

export async function adminLoginIdsSummaryForTenants(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, string[]>();
  const rows = await prisma.user.findMany({
    where: { tenantId: { in: tenantIds }, role: 'ADMIN', isActive: true, ...PLATFORM_SUPPORT_USER_WHERE },
    select: { tenantId: true, email: true, isTenantOwner: true, createdAt: true },
    orderBy: [{ isTenantOwner: 'desc' }, { createdAt: 'asc' }],
  });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.tenantId) ?? [];
    list.push(row.email);
    map.set(row.tenantId, list);
  }
  return map;
}

export async function createTenantAdminForPlatform(
  tenantId: string,
  data: { loginId: string; password: string; name?: string; isTenantOwner?: boolean },
) {
  await assertTenantExists(tenantId);
  const loginId = assertValidTenantLoginId(data.loginId);
  const password = data.password.trim();
  if (!password) throw new Error('비밀번호를 입력해주세요.');
  const name = (data.name?.trim() || '관리자').slice(0, 64);

  const taken = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: loginId } },
  });
  if (taken) throw new Error('이미 사용 중인 관리자 아이디입니다.');

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: {
      tenantId,
      email: loginId,
      passwordHash,
      name,
      role: 'ADMIN',
      isTenantOwner: data.isTenantOwner ?? false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isTenantOwner: true,
      createdAt: true,
    },
  });
  return toPlatformTenantAdmin(created);
}

export async function updateTenantAdminForPlatform(
  tenantId: string,
  adminId: string,
  data: {
    loginId?: string;
    password?: string;
    name?: string;
    isActive?: boolean;
    isTenantOwner?: boolean;
  },
) {
  await assertTenantExists(tenantId);
  const existing = await prisma.user.findFirst({
    where: { id: adminId, tenantId, role: 'ADMIN', ...PLATFORM_SUPPORT_USER_WHERE },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isTenantOwner: true,
      createdAt: true,
    },
  });
  if (!existing) throw new Error('관리자 계정을 찾을 수 없습니다.');

  const patch: {
    email?: string;
    passwordHash?: string;
    name?: string;
    isActive?: boolean;
    isTenantOwner?: boolean;
  } = {};

  if (data.loginId !== undefined) {
    const raw = data.loginId.trim().toLowerCase();
    if (raw !== existing.email) {
      const loginId = assertValidTenantLoginId(raw);
      const taken = await prisma.user.findFirst({
        where: { tenantId, email: loginId, id: { not: adminId } },
      });
      if (taken) throw new Error('이미 사용 중인 관리자 아이디입니다.');
      patch.email = loginId;
    }
  }

  if (data.name !== undefined) {
    const name = data.name.trim().slice(0, 64);
    if (!name) throw new Error('관리자 이름을 입력해주세요.');
    patch.name = name;
  }

  if (data.password !== undefined && data.password.trim()) {
    patch.passwordHash = await bcrypt.hash(data.password.trim(), 10);
  }

  if (data.isActive !== undefined) {
    if (!data.isActive && existing.isActive) {
      const activeCount = await prisma.user.count({
        where: { tenantId, role: 'ADMIN', isActive: true },
      });
      if (activeCount <= 1) {
        throw new Error('마지막 활성 관리자 계정은 비활성화할 수 없습니다.');
      }
    }
    patch.isActive = data.isActive;
  }

  if (data.isTenantOwner !== undefined) {
    patch.isTenantOwner = data.isTenantOwner;
  }

  if (Object.keys(patch).length === 0) {
    return toPlatformTenantAdmin(existing);
  }

  const updated = await prisma.user.update({
    where: { id: adminId },
    data: patch,
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isTenantOwner: true,
      createdAt: true,
    },
  });
  return toPlatformTenantAdmin(updated);
}
