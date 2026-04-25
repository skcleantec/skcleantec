import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import type { AuthPayload } from './auth.middleware.js';
import { isTeamPreviewAdminEmail } from './teamPreview.helpers.js';
import { prisma } from '../../lib/prisma.js';

export async function teamAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    const allowedTeamLeader =
      payload.role === 'TEAM_LEADER' || payload.role === 'EXTERNAL_PARTNER';
    const allowedPreviewStaff =
      (payload.role === 'ADMIN' || payload.role === 'MARKETER') &&
      isTeamPreviewAdminEmail(payload.email);
    if (!allowedTeamLeader && !allowedPreviewStaff) {
      res.status(403).json({ error: '팀장 권한이 필요합니다.' });
      return;
    }
    let effective = payload;
    const q = req.query as { previewRole?: string; previewExternalName?: string; externalCompanyId?: string };
    const previewExternal = allowedPreviewStaff && q.previewRole === 'external';
    if (previewExternal) {
      const previewExternalName =
        typeof q.previewExternalName === 'string' && q.previewExternalName.trim()
          ? q.previewExternalName.trim()
          : '클린느';
      const queryCompanyId =
        typeof q.externalCompanyId === 'string' && q.externalCompanyId.trim()
          ? q.externalCompanyId.trim()
          : '';
      const target = await prisma.user.findFirst({
        where: {
          role: 'EXTERNAL_PARTNER',
          isActive: true,
          ...(queryCompanyId
            ? { externalCompanyId: queryCompanyId }
            : { externalCompany: { is: { name: previewExternalName } } }),
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true },
      });
      if (!target) {
        res.status(400).json({ error: `타업체 프리뷰 계정을 찾을 수 없습니다: ${previewExternalName}` });
        return;
      }
      effective = {
        userId: target.id,
        email: target.email,
        role: 'EXTERNAL_PARTNER',
      };
    }
    (req as Request & { user: AuthPayload }).user = effective;
    next();
  } catch (e) {
    console.error('[teamAuthMiddleware]', e);
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}
