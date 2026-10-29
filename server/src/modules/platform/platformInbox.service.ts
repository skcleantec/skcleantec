import { prisma } from '../../lib/prisma.js';
import { approveAlimtalkChargeRequest } from '../alimtalk/alimtalkChargeRequest.service.js';
import { confirmInvoicePayment } from '../billing/tenantBilling.service.js';

export type InboxMoneyKind = 'charge' | 'deposit' | 'overdue';

export type InboxMoneyRow = {
  id: string;
  kind: InboxMoneyKind;
  tenantId: string;
  tenantName: string;
  amountKrw: number;
  depositorName: string | null;
  waitingSince: string;
  canReject: boolean;
};

const OPEN_INVOICE = ['ISSUED', 'OVERDUE'] as const;

function moneyRow(input: InboxMoneyRow): InboxMoneyRow {
  return input;
}

export async function getPlatformInbox() {
  const [charges, depositInvoices, overdueInvoices, signup, planUpgrade, landingLink, pg, barobill] =
    await Promise.all([
      prisma.alimtalkChargeRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 100,
        include: { tenant: { select: { name: true } } },
      }),
      prisma.tenantInvoice.findMany({
        where: {
          status: { in: [...OPEN_INVOICE] },
          paymentConfirmationRequestedAt: { not: null },
        },
        orderBy: { paymentConfirmationRequestedAt: 'asc' },
        take: 100,
        include: { tenant: { select: { name: true } } },
      }),
      prisma.tenantInvoice.findMany({
        where: { status: 'OVERDUE', paymentConfirmationRequestedAt: null },
        orderBy: { dueDate: 'asc' },
        take: 100,
        include: { tenant: { select: { name: true } } },
      }),
      prisma.platformSignupInquiry.count({ where: { status: 'PENDING' } }),
      prisma.tenantPlanUpgradeRequest.count({ where: { status: 'PENDING' } }),
      prisma.landingContactLinkSlotRequest.count({ where: { status: 'PENDING' } }),
      prisma.tenantPgOnboarding.count({ where: { status: 'SUBMITTED' } }),
      prisma.barobillMember.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);

  const money: InboxMoneyRow[] = [
    ...charges.map((row) =>
      moneyRow({
        id: row.id,
        kind: 'charge',
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        amountKrw: row.amountKrw,
        depositorName: row.memo?.trim() || null,
        waitingSince: row.createdAt.toISOString(),
        canReject: true,
      }),
    ),
    ...depositInvoices.map((row) =>
      moneyRow({
        id: row.id,
        kind: 'deposit',
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        amountKrw: row.amountKrw,
        depositorName: null,
        waitingSince: (row.paymentConfirmationRequestedAt ?? row.createdAt).toISOString(),
        canReject: true,
      }),
    ),
    ...overdueInvoices.map((row) =>
      moneyRow({
        id: row.id,
        kind: 'overdue',
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        amountKrw: row.amountKrw,
        depositorName: null,
        waitingSince: row.dueDate.toISOString(),
        canReject: false,
      }),
    ),
  ].sort((a, b) => a.waitingSince.localeCompare(b.waitingSince));

  const review = { signup, planUpgrade, landingLink, pg, barobill };
  const reviewTotal = signup + planUpgrade + landingLink + pg + barobill;
  return {
    money,
    review,
    pendingTotal: money.length + reviewTotal,
  };
}

export type InboxActionInput = {
  kind: InboxMoneyKind;
  id: string;
  tenantId: string;
  action: 'approve' | 'reject';
  platformUserId: string;
};

export async function applyPlatformInboxAction(input: InboxActionInput): Promise<void> {
  if (input.kind === 'charge' && input.action === 'approve') {
    await approveAlimtalkChargeRequest({
      tenantId: input.tenantId,
      chargeRequestId: input.id,
      actorPlatformUserId: input.platformUserId,
    });
    return;
  }
  if (input.kind === 'charge' && input.action === 'reject') {
    const updated = await prisma.alimtalkChargeRequest.updateMany({
      where: { id: input.id, tenantId: input.tenantId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        actorPlatformUserId: input.platformUserId,
      },
    });
    if (updated.count !== 1) throw new Error('이미 처리된 충전 신청입니다.');
    return;
  }
  if ((input.kind === 'deposit' || input.kind === 'overdue') && input.action === 'approve') {
    await confirmInvoicePayment(input.id, input.platformUserId, input.tenantId);
    return;
  }
  if (input.kind === 'deposit' && input.action === 'reject') {
    const updated = await prisma.tenantInvoice.updateMany({
      where: {
        id: input.id,
        tenantId: input.tenantId,
        status: { in: [...OPEN_INVOICE] },
        paymentConfirmationRequestedAt: { not: null },
      },
      data: { paymentConfirmationRequestedAt: null },
    });
    if (updated.count !== 1) throw new Error('이미 처리된 입금 확인 요청입니다.');
    return;
  }
  throw new Error('미납 청구는 목록에서 반려할 수 없습니다. 입금 확인만 할 수 있습니다.');
}

export async function applyPlatformInboxBulk(
  items: Omit<InboxActionInput, 'platformUserId' | 'action'>[],
  platformUserId: string,
): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const item of items) {
    try {
      await applyPlatformInboxAction({ ...item, action: 'approve', platformUserId });
      results.push({ id: item.id, ok: true });
    } catch (err) {
      results.push({ id: item.id, ok: false, error: err instanceof Error ? err.message : '처리하지 못했습니다.' });
    }
  }
  return results;
}
