import type { Prisma, PrismaClient } from '@prisma/client';

export const MSG_EXTERNAL_COMPANY_USAGE_DISABLED =
  '사용 중지된 타업체입니다. 새 배정·노출에는 선택할 수 없습니다.';

type Db = PrismaClient | Prisma.TransactionClient;

/** 신규 배정·DB마켓 노출·캘린더 추가 등 선택 가능한 타업체 */
export function selectableExternalCompanyWhere(tenantId: string): Prisma.ExternalCompanyWhereInput {
  return { tenantId, isActive: true, usageDisabledAt: null };
}

export function isExternalCompanySelectable(row: {
  isActive: boolean;
  usageDisabledAt: Date | null;
}): boolean {
  return row.isActive && row.usageDisabledAt == null;
}

export class ExternalCompanyUsageError extends Error {
  constructor(message = MSG_EXTERNAL_COMPANY_USAGE_DISABLED) {
    super(message);
    this.name = 'ExternalCompanyUsageError';
  }
}

export async function assertExternalCompanySelectable(
  db: Db,
  tenantId: string,
  externalCompanyId: string | null | undefined,
): Promise<void> {
  if (!externalCompanyId) return;
  const row = await db.externalCompany.findFirst({
    where: { id: externalCompanyId, tenantId, isActive: true },
    select: { usageDisabledAt: true },
  });
  if (!row) {
    throw new ExternalCompanyUsageError('타업체를 찾을 수 없습니다.');
  }
  if (row.usageDisabledAt != null) {
    throw new ExternalCompanyUsageError();
  }
}

/** 타업체 EXTERNAL_PARTNER — 신규 배정 시에만 selectable 검사(기존 동일 사용자 유지 허용) */
export async function assertNewExternalPartnerUsersSelectable(
  db: Db,
  tenantId: string,
  previousExternalUserIds: ReadonlySet<string>,
  assignees: ReadonlyArray<{ id: string; role: string; externalCompanyId: string | null }>,
): Promise<void> {
  for (const a of assignees) {
    if (a.role !== 'EXTERNAL_PARTNER') continue;
    if (previousExternalUserIds.has(a.id)) continue;
    await assertExternalCompanySelectable(db, tenantId, a.externalCompanyId);
  }
}
