import type { Prisma, PrismaClient } from '@prisma/client';

export const MSG_EXTERNAL_BLOCKS_PARTNER_SHARE =
  '타업체 담당이 있는 접수는 파트너 연계할 수 없습니다. 타업체 담당을 해제한 뒤 다시 시도해 주세요.';

export const MSG_PARTNER_SHARE_BLOCKS_EXTERNAL =
  '파트너 연계가 있는 접수는 타업체 담당을 배정할 수 없습니다. 접수 연계를 취소한 뒤 다시 시도해 주세요.';

type Db = PrismaClient | Prisma.TransactionClient;

export async function inquiryHasExternalPartnerAssignment(
  db: Db,
  tenantId: string,
  inquiryId: string,
): Promise<boolean> {
  const count = await db.assignment.count({
    where: {
      inquiryId,
      teamLeader: { tenantId, role: 'EXTERNAL_PARTNER' },
    },
  });
  return count > 0;
}

export async function loadActiveShareSourceMeta(
  db: Db,
  inquiryId: string,
): Promise<{ syncStatus: string; settlementMode: string } | null> {
  const row = await db.tenantInquiryShare.findUnique({
    where: { sourceInquiryId: inquiryId },
    select: { syncStatus: true, settlementMode: true },
  });
  if (!row || row.syncStatus !== 'ACTIVE') return null;
  return row;
}

export async function inquiryHasActivePartnerShareSource(
  db: Db,
  inquiryId: string,
): Promise<boolean> {
  return (await loadActiveShareSourceMeta(db, inquiryId)) != null;
}

/** 일반 파트너 연계 — 타업체 배정·수수료와 상호 배타 */
export async function inquiryHasActiveNativePartnerShareSource(
  db: Db,
  inquiryId: string,
): Promise<boolean> {
  const row = await loadActiveShareSourceMeta(db, inquiryId);
  return row != null && row.settlementMode === 'PARTNER_NATIVE';
}

export async function assertNoExternalPartnerForPartnerShare(
  db: Db,
  tenantId: string,
  inquiryId: string,
): Promise<void> {
  if (await inquiryHasExternalPartnerAssignment(db, tenantId, inquiryId)) {
    throw new Error(MSG_EXTERNAL_BLOCKS_PARTNER_SHARE);
  }
}

export async function assertNoActivePartnerShareForExternalAssign(
  db: Db,
  inquiryId: string,
): Promise<void> {
  if (await inquiryHasActivePartnerShareSource(db, inquiryId)) {
    throw new Error(MSG_PARTNER_SHARE_BLOCKS_EXTERNAL);
  }
}
