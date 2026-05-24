import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { isPlatformAuthPayload, type PlatformAuthPayload } from './platformAuth.types.js';

export type PlatformScopedRequest = Request & { platformUser: PlatformAuthPayload };

export function platformAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '플랫폼 인증이 필요합니다.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!isPlatformAuthPayload(payload)) {
      res.status(401).json({ error: '플랫폼 토큰이 아닙니다.', code: 'token_invalid' });
      return;
    }
    (req as PlatformScopedRequest).platformUser = payload;
    next();
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: '로그인이 만료되었습니다.', code: 'token_expired' });
      return;
    }
    res.status(401).json({ error: '유효하지 않은 토큰입니다.', code: 'token_invalid' });
  }
}

export function platformSuperAdminOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as PlatformScopedRequest).platformUser;
  if (!user || user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: '플랫폼 최고 관리자 권한이 필요합니다.' });
    return;
  }
  next();
}
