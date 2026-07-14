import type { NextFunction, Request, Response } from 'express';
import type { AuthPayload } from './auth.middleware.js';
import { userHasStaffAdminAccess } from './staffAdminAccess.service.js';

/** 관리자 전용 GNB — ADMIN 또는 admin.* 마케터 */
export async function requireStaffAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = (req as unknown as { user?: AuthPayload }).user;
  if (!(await userHasStaffAdminAccess(user))) {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    return;
  }
  next();
}
