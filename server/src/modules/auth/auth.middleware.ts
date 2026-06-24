import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { isTenantOwnerAdmin } from './tenantOwner.js';
import {
  userHasMarketerOperationalAdminAccess,
  userHasStaffAdminAccess,
} from './staffAdminAccess.service.js';

export type CrewViewerRole = 'LEADER' | 'MEMBER';

export type CrewJwtSource = 'login' | 'preview';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  /** 테넌트 업무 JWT — ADMIN/MARKETER/TEAM_LEADER/EXTERNAL_PARTNER */
  tenantId?: string;
  /** ADMIN 전용 — 업체 소유자(히스토리 삭제·광고 채널 설정 등) */
  isTenantOwner?: boolean;
  /** 플랫폼 지원 접속 — 모든 테넌트 /admin 장애 대응용 */
  isPlatformSupportAccess?: boolean;
  /** TEAM_CREW_GROUP 전용 — JWT에 포함 */
  crewGroupId?: string;
  crewViewerRole?: CrewViewerRole;
  /** 크루 JWT만 — 미리보기 발급 시 정산표 등에서 조장 비번 검증 생략 */
  crewJwtSource?: CrewJwtSource;
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
  } catch (e) {
    /**
     * 만료/형식오류는 운영에서 정상 흐름. 클라이언트가 `code`로 자동 로그아웃하도록 표시.
     */
    if (e instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: '로그인이 만료되었습니다.', code: 'token_expired' });
      return;
    }
    if (e instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: '유효하지 않은 토큰입니다.', code: 'token_invalid' });
      return;
    }
    console.error('[authMiddleware]', e);
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
      const user = (req as Request & { user?: AuthPayload }).user;
      if (!user) {
        res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        return;
      }
      if (user.role === 'ADMIN') {
        next();
        return;
      }
      if (user.role === 'MARKETER' && (await userHasStaffAdminAccess(user))) {
        next();
        return;
      }
      res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    } catch (e) {
      next(e);
    }
  })();
}

/** JWT role=ADMIN 만 — 마케터 승격 설정 등 (승격된 마케터 제외) */
export function adminRoleOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자 계정만 할 수 있습니다.' });
    return;
  }
  next();
}

/** ADMIN 또는 운영 권한 마케터(LIMITED·FULL) — 접수 수정·팀원 풀 조회 등 */
export function adminOrOperationalMarketer(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
      const user = (req as Request & { user?: AuthPayload }).user;
      if (!user) {
        res.status(403).json({ error: '권한이 필요합니다.' });
        return;
      }
      if (user.role === 'ADMIN') {
        next();
        return;
      }
      if (user.role === 'MARKETER' && (await userHasMarketerOperationalAdminAccess(user))) {
        next();
        return;
      }
      res.status(403).json({ error: '권한이 필요합니다.' });
    } catch (e) {
      next(e);
    }
  })();
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

/** 업체 소유 ADMIN 전용 — 히스토리 삭제·광고 채널 reorder 등 */
export function tenantOwnerOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!isTenantOwnerAdmin(user)) {
    res.status(403).json({ error: '업체 관리자(소유자)만 할 수 있습니다.' });
    return;
  }
  next();
}

/** @deprecated `tenantOwnerOnly` — 하위 호환 alias */
export function superAdminOnly(req: Request, res: Response, next: NextFunction) {
  tenantOwnerOnly(req, res, next);
}

export function crewGroupOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || user.role !== 'TEAM_CREW_GROUP' || !user.crewGroupId) {
    res.status(403).json({ error: '크루 그룹 로그인이 필요합니다.' });
    return;
  }
  next();
}

/** 크루 JWT에 그룹장 뷰(LEADER)인 경우만 통과 — 공유 로그인에서 조장 슬롯이 있을 때 발급 */
export function crewLeaderJwtOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || user.crewViewerRole !== 'LEADER') {
    res.status(403).json({ error: '그룹장만 이용할 수 있습니다.' });
    return;
  }
  next();
}

