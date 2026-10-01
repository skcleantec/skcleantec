import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isTeamLeaderHomeReady } from './teamLeaderHome.service.js';

const CACHE_MS = 20_000;
const readyCache = new Map<string, { ready: boolean; at: number }>();

export function invalidateTeamLeaderHomeGate(userId: string): void {
  readyCache.delete(userId);
}

function isExempt(path: string, method: string): boolean {
  if (path.startsWith('/api/auth')) return true;
  if (path.startsWith('/api/health')) return true;
  if (path.startsWith('/api/geocode')) return true;
  if (path.startsWith('/api/push')) return true;
  if (path.startsWith('/api/platform')) return true;
  if (method === 'GET' && (path === '/api/team/me' || path.startsWith('/api/team/me?'))) return true;
  return false;
}

/**
 * 팀장 JWT는 집 주소·좌표가 있을 때만 업무 API를 연다.
 * 관리자 미리보기 JWT(ADMIN/MARKETER)는 여기서 막지 않는다.
 */
export async function teamLeaderHomeAddressGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.originalUrl.split('?')[0] ?? req.path;
  if (!path.startsWith('/api/')) {
    next();
    return;
  }
  if (isExempt(path, req.method)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as AuthPayload;
  } catch {
    next();
    return;
  }
  if (payload.role !== 'TEAM_LEADER' || !payload.userId) {
    next();
    return;
  }

  const cached = readyCache.get(payload.userId);
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    if (cached.ready) {
      next();
      return;
    }
    res.status(403).json({
      error: '집 주소를 입력해야 청소비서를 이용할 수 있습니다.',
      code: 'home_address_required',
    });
    return;
  }

  const row = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      role: 'TEAM_LEADER',
      ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
    },
    select: { homeAddress: true, homeGeoLat: true, homeGeoLng: true },
  });
  const ready = isTeamLeaderHomeReady(row);
  readyCache.set(payload.userId, { ready, at: now });
  if (ready) {
    next();
    return;
  }
  res.status(403).json({
    error: '집 주소를 입력해야 청소비서를 이용할 수 있습니다.',
    code: 'home_address_required',
  });
}
