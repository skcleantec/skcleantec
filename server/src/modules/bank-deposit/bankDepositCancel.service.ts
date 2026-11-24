/** 입금 예약취소. 접수 저장과 분리되어, 여기서 실패해도 접수 트랜잭션은 이미 끝나 있다. */

import { type Prisma, type PrismaClient } from '@prisma/client';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { inquiryDepositSync, restoredDepositStatus } from './bankDepositCancel.logic.js';
import { publishBankDeposit } from './bankDepositPublish.js';
import { rematchNeedsReviewDeposit } from './bankDeposit.service.js';
import { onDepositIgnored } from './bankDepositTeam.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

const INQUIRY_CANCEL_NOTE = '접수 예약취소';

async function markCancelled(
  db: Db,
  input: {
    tenantId: string;
    id: string;
    userId: string | null;
    cancelledBy: 'staff' | 'inquiry';
    note: string | null;
    keepNote: boolean;
    now: Date;
  },
) {
  const row = await db.bankDeposit.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!row) return { error: 'missing' as const };
  if (row.status === 'CANCELLED') return { ok: true as const, already: true as const };
  await db.bankDeposit.updateMany({
    where: { id: row.id, tenantId: input.tenantId, status: row.status },
    data: {
      status: 'CANCELLED',
      cancelledAt: input.now,
      cancelledByUserId: input.userId,
      cancelledBy: input.cancelledBy,
      cancelPrevStatus: row.status,
      ...(input.keepNote ? {} : { note: input.note }),
    },
  });
  await db.bankDepositExpectation.updateMany({
    where: { tenantId: input.tenantId, matchedDepositId: row.id, status: 'MATCHED' },
    data: { status: 'CANCELLED', waitingKey: null },
  });
  if (row.status === 'NEEDS_REVIEW') {
    await onDepositIgnored(db, input.tenantId, row.id, input.now);
  }
  await publishBankDeposit(db, {
    tenantId: input.tenantId,
    event: 'changed',
    id: row.id,
    status: 'CANCELLED',
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: row.linkedInquiryId,
    linkedFollowupId: row.linkedFollowupId,
    linkedKind: row.linkedKind,
  });
  return { ok: true as const, already: false as const };
}

export async function cancelBankDeposit(
  db: Db,
  tenantId: string,
  id: string,
  userId: string,
  note: string | null,
  noteGiven: boolean,
  now = new Date(),
) {
  return markCancelled(db, {
    tenantId,
    id,
    userId,
    cancelledBy: 'staff',
    note,
    keepNote: !noteGiven,
    now,
  });
}

export async function uncancelBankDeposit(db: Db, tenantId: string, id: string, now = new Date()) {
  const row = await db.bankDeposit.findFirst({ where: { id, tenantId } });
  if (!row) return { error: 'missing' as const };
  if (row.status !== 'CANCELLED') return { error: 'not_cancelled' as const };
  const linked = Boolean(row.linkedInquiryId || row.linkedFollowupId);
  const next = restoredDepositStatus({ cancelPrevStatus: row.cancelPrevStatus, linked });
  const updated = await db.bankDeposit.updateMany({
    where: { id, tenantId, status: 'CANCELLED' },
    data: {
      status: next,
      cancelledAt: null,
      cancelledByUserId: null,
      cancelledBy: null,
      cancelPrevStatus: null,
      ...(next === 'NEEDS_REVIEW'
        ? { openReminderStoppedAt: null, teamRemindedAt: null, noOwnerNotifiedAt: null }
        : {}),
    },
  });
  if (updated.count !== 1) return { error: 'missing' as const };
  await db.bankDepositExpectation.updateMany({
    where: { tenantId, matchedDepositId: id, status: 'CANCELLED' },
    data: { status: 'MATCHED' },
  });
  if (next === 'NEEDS_REVIEW') {
    await rematchNeedsReviewDeposit(db, tenantId, id, now);
    return { ok: true as const };
  }
  await publishBankDeposit(db, {
    tenantId,
    event: 'changed',
    id: row.id,
    status: next,
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    linkedInquiryId: row.linkedInquiryId,
    linkedFollowupId: row.linkedFollowupId,
    linkedKind: row.linkedKind,
  });
  return { ok: true as const };
}

/**
 * 접수 상태가 저장된 뒤 호출한다.
 * 부재·보류(OrderFollowup)에는 취소 상태가 없어 여기 걸지 않는다. 처리 완료는 예약으로 넘어갈 때도 쓰인다.
 */
export async function syncBankDepositsForInquiryStatus(
  db: Db,
  tenantId: string,
  inquiryId: string,
  previousStatus: string,
  nextStatus: string,
  now = new Date(),
) {
  const action = inquiryDepositSync(previousStatus, nextStatus);
  if (action === 'none') return;
  if (!(await isFeatureEnabled(tenantId, 'mod_bank_deposit'))) return;
  if (action === 'cancel') {
    const rows = await db.bankDeposit.findMany({
      where: { tenantId, linkedInquiryId: inquiryId, status: { in: ['AUTO_LINKED', 'LINKED'] } },
      select: { id: true },
    });
    for (const row of rows) {
      await markCancelled(db, {
        tenantId,
        id: row.id,
        userId: null,
        cancelledBy: 'inquiry',
        note: INQUIRY_CANCEL_NOTE,
        keepNote: false,
        now,
      });
    }
    return;
  }
  const rows = await db.bankDeposit.findMany({
    where: { tenantId, linkedInquiryId: inquiryId, status: 'CANCELLED', cancelledBy: 'inquiry' },
    select: { id: true },
  });
  for (const row of rows) {
    await uncancelBankDeposit(db, tenantId, row.id, now);
  }
}
