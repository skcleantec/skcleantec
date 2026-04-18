import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { isSuperAdminRoleAndEmail } from './superAdmin.js';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    (req as Request & { user: AuthPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    return;
  }
  next();
}

/** ADMIN 또는 MARKETER 허용 (발주서 발급 등) */
export function adminOrMarketer(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MARKETER')) {
    res.status(403).json({ error: '권한이 필요합니다.' });
    return;
  }
  next();
}

/** 스케줄 지도용 배치 지오코딩: 관리자·마케터·팀장·타업체 */
export function adminOrMarketerOrTeamLeader(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user) {
    res.status(403).json({ error: '권한이 필요합니다.' });
    return;
  }
  if (
    user.role === 'ADMIN' ||
    user.role === 'MARKETER' ||
    user.role === 'TEAM_LEADER' ||
    user.role === 'EXTERNAL_PARTNER'
  ) {
    next();
    return;
  }
  res.status(403).json({ error: '권한이 필요합니다.' });
}

/** 최고 관리자(기본: 이메일 admin) 전용 — 히스토리 삭제 등 */
export function superAdminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || !isSuperAdminRoleAndEmail(user.role, user.email)) {
    res.status(403).json({ error: '최고 관리자만 할 수 있습니다.' });
    return;
  }
  next();
}
