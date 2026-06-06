import type { Prisma, PrismaClient } from '@prisma/client';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
import { getOperatingCompanyPolicy } from './operatingCompanyPolicy.js';

type Db = PrismaClient | Prisma.TransactionClient;

export class OperatingCompanyAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperatingCompanyAssignmentError';
  }
}

export async function listOperatingCompanyIdsForUser(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<string[]> {
  const rows = await db.userOperatingCompany.findMany({
    where: { tenantId, userId },
    select: { operatingCompanyId: true },
  });
  return rows.map((r) => r.operatingCompanyId);
}

/** 팀장 앱 목록 — own_brands_only 일 때 접수 where 조각. null이면 추가 필터 없음 */
export async function buildTeamLeaderInquiryBrandFilter(
  db: Db,
  tenantId: string,
  viewerUserId: string,
): Promise<Prisma.InquiryWhereInput | null> {
  const policy = await getOperatingCompanyPolicy(db, tenantId);
  if (policy.teamLeaderListMode !== 'own_brands_only') return null;
  const ocIds = await listOperatingCompanyIdsForUser(db, tenantId, viewerUserId);
  if (ocIds.length === 0) return { operatingCompanyId: { in: [] } };
  return { operatingCompanyId: { in: ocIds } };
}

export function mergeInquiryWhere(
  base: Prisma.InquiryWhereInput,
  extra: Prisma.InquiryWhereInput | null | undefined,
): Prisma.InquiryWhereInput {
  if (!extra) return base;
  return { AND: [base, extra] };
}

type AssigneeRow = {
  id: string;
  role: string;
  email?: string | null;
};

/** strict 정책 — 접수 영업 브랜드와 팀장 소속이 맞는지 검증 (타업체·개발 ADMIN 프리뷰 제외) */
export async function assertTeamLeadersMatchInquiryBrand(params: {
  db: Db;
  tenantId: string;
  inquiryOperatingCompanyId: string;
  assignees: AssigneeRow[];
}): Promise<void> {
  const { db, tenantId, inquiryOperatingCompanyId, assignees } = params;
  const policy = await getOperatingCompanyPolicy(db, tenantId);
  if (policy.assignmentMode !== 'strict') return;

  const leadersToCheck = assignees.filter(
    (a) =>
      a.role === 'TEAM_LEADER' ||
      (a.role === 'ADMIN' && isTeamPreviewAdminEmail(a.email ?? '')),
  );
  if (leadersToCheck.length === 0) return;

  const memberships = await db.userOperatingCompany.findMany({
    where: {
      tenantId,
      operatingCompanyId: inquiryOperatingCompanyId,
      userId: { in: leadersToCheck.map((a) => a.id) },
    },
    select: { userId: true },
  });
  const allowed = new Set(memberships.map((m) => m.userId));
  for (const a of leadersToCheck) {
    if (!allowed.has(a.id)) {
      throw new OperatingCompanyAssignmentError(
        '엄격 배정 정책: 이 접수 영업 브랜드에 소속된 팀장만 배정할 수 있습니다.',
      );
    }
  }
}

/** 드롭다운용 — strict + operatingCompanyId 일 때 해당 브랜드 소속 팀장 id 집합 */
export async function allowedTeamLeaderIdsForInquiryBrand(
  db: Db,
  tenantId: string,
  operatingCompanyId: string | null | undefined,
  candidateUserIds: string[],
): Promise<Set<string>> {
  const policy = await getOperatingCompanyPolicy(db, tenantId);
  if (policy.assignmentMode !== 'strict' || !operatingCompanyId?.trim()) {
    return new Set(candidateUserIds);
  }
  if (candidateUserIds.length === 0) return new Set();
  const rows = await db.userOperatingCompany.findMany({
    where: {
      tenantId,
      operatingCompanyId: operatingCompanyId.trim(),
      userId: { in: candidateUserIds },
    },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}
