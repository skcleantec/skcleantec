import type { Prisma, PrismaClient } from '@prisma/client';
import { inquiryHasActivePartnerShareSource } from './inquiryExternalPartnerShareMutex.js';

export const MSG_HANDED_OFF_BLOCKS_INTERNAL_ASSIGN =
  '파트너 연계·정보공유로 넘긴 접수에는 자사 팀장을 배정할 수 없습니다.';

/** 정보공유 — 게시·인계·확정 단계(장바구니 DRAFT 제외) */
const ACTIVE_DB_LISTING_STATUSES = ['OPEN', 'PENDING_SELLER', 'CONFIRMED'] as const;

type Db = PrismaClient | Prisma.TransactionClient;

export async function inquiryHasActiveDbMarketplaceHandoff(
  db: Db,
  inquiryId: string,
): Promise<boolean> {
  const row = await db.inquiryDbListing.findFirst({
    where: { inquiryId },
    select: { status: true },
  });
  if (!row) return false;
  return (ACTIVE_DB_LISTING_STATUSES as readonly string[]).includes(row.status);
}

/** 송신 테넌트 — 파트너 연계·정보공유로 자사 운영에서 넘긴 접수 */
export async function inquiryIsHandedOffFromInternalOps(
  db: Db,
  inquiryId: string,
): Promise<boolean> {
  if (await inquiryHasActivePartnerShareSource(db, inquiryId)) return true;
  return inquiryHasActiveDbMarketplaceHandoff(db, inquiryId);
}

/**
 * 팀장 목록·스케줄·C/S(배정 연결) — 송신측 넘긴 접수 제외.
 * stale Assignment가 DB에 남아 있어도 UI·알림 대상에서 빠지게 한다.
 */
export function whereExcludeHandedOffSourceInquiries(): Prisma.InquiryWhereInput {
  return {
    NOT: {
      OR: [
        { tenantSharesAsSource: { some: { syncStatus: 'ACTIVE' } } },
        { dbListing: { status: { in: [...ACTIVE_DB_LISTING_STATUSES] } } },
      ],
    },
  };
}

/**
 * 팀 API — 조회 주체가 타업체(EXTERNAL_PARTNER)일 때.
 * 정보공유(EXTERNAL_COMPANY) 인계 확정 후 본인에게 배정된 접수는 스케줄·배정목록에 포함해야 한다.
 * (송신측 자사 팀장용 dbListing·파트너 송신 제외는 타업체 화면에 적용하지 않는다.)
 */
export function whereExcludeHandedOffSourceInquiriesForTeamViewer(
  viewerRole: string | undefined,
): Prisma.InquiryWhereInput {
  if (viewerRole === 'EXTERNAL_PARTNER') {
    return {};
  }
  return whereExcludeHandedOffSourceInquiries();
}

/** 자사 팀장·관리자(미리보기) 배정 시 — 넘긴 접수면 거부 */
export async function assertInternalTeamAssignAllowed(
  db: Db,
  tenantId: string,
  inquiryId: string,
  teamLeaderIds: readonly string[],
): Promise<void> {
  if (teamLeaderIds.length === 0) return;

  const assignees = await db.user.findMany({
    where: { id: { in: [...teamLeaderIds] }, tenantId },
    select: { role: true },
  });
  const assignsInternal = assignees.some((u) => u.role === 'TEAM_LEADER' || u.role === 'ADMIN');
  if (!assignsInternal) return;

  if (await inquiryIsHandedOffFromInternalOps(db, inquiryId)) {
    throw new Error(MSG_HANDED_OFF_BLOCKS_INTERNAL_ASSIGN);
  }
}
