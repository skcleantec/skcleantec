import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

/**
 * 크루 정산표 조회 API 전용 — 미리보기 JWT는 통과, 일반 로그인은 그룹장 구역(LEADER JWT) +
 * 설정용 비밀번호(조장 비번) 헤더 검증.
 */
export async function crewSettlementPayrollSheetAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || user.role !== 'TEAM_CREW_GROUP' || !user.crewGroupId) {
    res.status(403).json({ error: '크루 그룹 로그인이 필요합니다.' });
    return;
  }

  if (user.crewJwtSource === 'preview') {
    next();
    return;
  }

  if (user.crewViewerRole !== 'LEADER') {
    res.status(403).json({ error: '정산표는 그룹장이 지정된 크루만 조회할 수 있습니다.' });
    return;
  }

  try {
    const group = await prisma.teamCrewGroup.findUnique({
      where: { id: user.crewGroupId },
      select: { settingsPasswordHash: true },
    });
    const hash = group?.settingsPasswordHash;
    if (!hash) {
      res.status(403).json({
        error: '조장 비밀번호가 설정되지 않았습니다. 관리자에게 요청해 주세요.',
        code: 'CREW_SENSITIVE_PASSWORD_NOT_SET',
      });
      return;
    }

    const raw = req.headers['x-crew-sensitive-password'];
    const pwd =
      typeof raw === 'string' ? raw : Array.isArray(raw) && raw.length ? String(raw[0]) : '';
    if (!pwd.trim()) {
      res.status(401).json({
        error: '조장 비밀번호가 필요합니다.',
        code: 'CREW_SENSITIVE_PASSWORD_REQUIRED',
      });
      return;
    }

    const ok = await bcrypt.compare(pwd.trim(), hash);
    if (!ok) {
      res.status(403).json({ error: '조장 비밀번호가 일치하지 않습니다.' });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
