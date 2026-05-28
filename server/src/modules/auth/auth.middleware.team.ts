import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import type { AuthPayload } from './auth.middleware.js';
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
    /** 관리자·마케터는 팀 API에서 previewRole로 팀장·타업체 화면 미리보기 가능 */
    const allowedPreviewStaff =
      payload.role === 'ADMIN' || payload.role === 'MARKETER';
    if (!allowedTeamLeader && !allowedPreviewStaff) {
      res.status(403).json({ error: '팀장 권한이 필요합니다.' });
      return;
    }
    let effective = payload;
    const q = req.query as {
      previewRole?: string;
      previewExternalName?: string;
      previewExternalUserId?: string;
      externalCompanyId?: string;
      previewTeamLeaderId?: string;
    };
    const previewExternal = allowedPreviewStaff && q.previewRole === 'external';
    const previewTeamLeaderFlag =
      allowedPreviewStaff &&
      q.previewRole === 'team_leader' &&
      typeof q.previewTeamLeaderId === 'string' &&
      q.previewTeamLeaderId.trim().length > 0;

    if (previewExternal) {
      const previewExternalName =
        typeof q.previewExternalName === 'string' && q.previewExternalName.trim()
          ? q.previewExternalName.trim()
          : '클린느';
      const queryUserId =
        typeof q.previewExternalUserId === 'string' && q.previewExternalUserId.trim()
          ? q.previewExternalUserId.trim()
          : '';
      const queryCompanyId =
        typeof q.externalCompanyId === 'string' && q.externalCompanyId.trim()
          ? q.externalCompanyId.trim()
          : '';
      const target = queryUserId
        ? await prisma.user.findFirst({
            where: { id: queryUserId, role: 'EXTERNAL_PARTNER', isActive: true },
            select: { id: true, email: true },
          })
        : await prisma.user.findFirst({
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
    } else if (previewTeamLeaderFlag) {
      const tlId = q.previewTeamLeaderId!.trim();
      const target = await prisma.user.findFirst({
        where: { id: tlId, role: 'TEAM_LEADER', isActive: true },
        select: { id: true, email: true },
      });
      if (!target) {
        res.status(400).json({ error: '팀장 프리뷰 계정을 찾을 수 없습니다.' });
        return;
      }
      effective = {
        userId: target.id,
        email: target.email,
        role: 'TEAM_LEADER',
      };
    }
    (req as Request & {
      user: AuthPayload;
      teamViewer?: {
        userId: string;
        role: string;
        email?: string;
        previewExternal: boolean;
        previewTeamLeader: boolean;
      };
    }).user = effective;
    (req as Request & {
      user: AuthPayload;
      teamViewer?: {
        userId: string;
        role: string;
        email?: string;
        previewExternal: boolean;
        previewTeamLeader: boolean;
      };
    }).teamViewer = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      previewExternal,
      previewTeamLeader: Boolean(previewTeamLeaderFlag && effective.userId !== payload.userId),
    };
    next();
  } catch (e) {
    /**
     * 만료·형식 오류는 운영에서 정상 흐름(만료된 클라이언트의 마지막 요청 등)이므로
     * 스택 트레이스를 찍지 않는다. Railway 로그 폭주·진짜 에러 가림 방지.
     */
    if (e instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: '로그인이 만료되었습니다.', code: 'token_expired' });
      return;
    }
    if (e instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: '유효하지 않은 토큰입니다.', code: 'token_invalid' });
      return;
    }
    console.error('[teamAuthMiddleware]', e);
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}
