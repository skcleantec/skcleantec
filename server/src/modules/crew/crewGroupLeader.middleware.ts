import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

/**
 * 공유 크루 계정 JWT의 crewViewerRole은 로그인 시점에 고정될 수 있어,
 * 그룹장 지정 후에도 /auth/crew-me 는 최신 DB를 반환하지만 PUT 은 403이 나는 불일치가 생긴다.
 * 명단 저장 등 — 그룹에 그룹장 슬롯이 있는지 DB로 확인한다.
 */
export function crewGroupLeaderFromDb(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
      const user = (req as Request & { user?: AuthPayload }).user;
      if (!user?.crewGroupId) {
        res.status(403).json({ error: '크루 그룹 로그인이 필요합니다.' });
        return;
      }
      const leaderCount = await prisma.teamCrewGroupMember.count({
        where: { groupId: user.crewGroupId, isGroupLeader: true },
      });
      if (leaderCount === 0) {
        res.status(403).json({ error: '그룹장이 지정되어 있지 않아 명단을 저장할 수 없습니다.' });
        return;
      }
      next();
    } catch (e) {
      next(e);
    }
  })();
}
