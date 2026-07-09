import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth, resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';

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
