import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth, resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import type { UserRole } from '@prisma/client';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import {
  mapOperatingCompanyResolveError,
  readCrmWorkBrandInput,
  resolveCrmWorkOperatingCompanyId,
} from './crmWorkBrandResolve.service.js';

export function requireTelecrmTenant(
  req: import('express').Request,
  res: Response,
): string | null {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

/** JWT tenantId 없을 때 users.tenant_id 폴백 (레거시 토큰·앱 폴링) */
export async function requireTelecrmTenantAsync(
  req: import('express').Request,
  res: Response,
): Promise<string | null> {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await resolveTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다. 다시 로그인해 주세요.' });
    return null;
  }
  return tenantId;
}

export async function requireTelecrmActorPassword(
  res: Response,
  userId: string,
  tenantId: string,
  password: unknown,
): Promise<boolean> {
  const raw = typeof password === 'string' ? password : '';
  if (!raw.trim()) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const actor = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { passwordHash: true },
  });
  if (!actor?.passwordHash) {
    res.status(403).json({ error: '세션이 유효하지 않습니다.' });
    return false;
  }
  const ok = await bcrypt.compare(raw, actor.passwordHash);
  if (!ok) {
    res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

export function parseSortOrder(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  return fallback;
}

export function parseAmountWon(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === 'string') {
    const t = raw.replace(/,/g, '').trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

/** CRM 작업 브랜드 — 쿼리 workBrand / operatingCompanyId 또는 body 동일 필드 */
export async function requireCrmWorkOperatingCompanyId(
  req: import('express').Request,
  res: Response,
): Promise<string | null> {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return null;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body =
    req.method !== 'GET' && req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : undefined;
  const brandInput = readCrmWorkBrandInput(req.query as Record<string, unknown>, body);
  try {
    const isStaffAdmin = await userHasStaffAdminAccess(user);
    return await resolveCrmWorkOperatingCompanyId({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      isStaffAdmin,
      ...brandInput,
    });
  } catch (e) {
    const mapped = mapOperatingCompanyResolveError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.message });
      return null;
    }
    throw e;
  }
}
