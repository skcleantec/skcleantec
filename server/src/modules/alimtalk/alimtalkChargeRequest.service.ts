import { prisma } from '../../lib/prisma.js';
import { ALIMTALK_TEMPLATE_CODES } from '../../lib/alimtalkPolicy.js';
import { parsePaymentNotifyEmailsFromSettings } from '../../lib/platformBillingNotifyEmails.js';
import { validateWalletChargeAmountKrw } from '../../lib/paymentTestAmount.js';
import { applyPlatformAlimtalkTopUp } from './alimtalkWallet.service.js';
import { notifyPlatformOps } from '../platform/platformInboxNotify.service.js';
import { ensurePlatformBillingSettings } from '../billing/tenantBilling.service.js';
import { scheduleIssueForBankWalletPayment } from '../platform-receipts/platformWalletInvoice.service.js';
import { notifyWalletChargeRequestByEmail } from './walletChargeRequest.email.js';

export type AlimtalkChargeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type AlimtalkChargeRequestDto = {
  id: string;
  amountKrw: number;
  memo: string | null;
  status: AlimtalkChargeRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export async function listAlimtalkChargeRequestsForTenant(
  tenantId: string,
  limit = 20,
): Promise<AlimtalkChargeRequestDto[]> {
  const rows = await prisma.alimtalkChargeRequest.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(mapChargeRequestDto);
}

export async function getPendingAlimtalkChargeRequestForTenant(
  tenantId: string,
): Promise<AlimtalkChargeRequestDto | null> {
  const row = await prisma.alimtalkChargeRequest.findFirst({
    where: { tenantId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  return row ? mapChargeRequestDto(row) : null;
}

export async function listPendingAlimtalkChargeRequestsForTenant(
  tenantId: string,
): Promise<AlimtalkChargeRequestDto[]> {
  const rows = await prisma.alimtalkChargeRequest.findMany({
    where: { tenantId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapChargeRequestDto);
}

export async function createAlimtalkChargeRequest(params: {
  tenantId: string;
  requestedByUserId: string;
  amountKrw: number;
  memo?: string | null;
}): Promise<AlimtalkChargeRequestDto> {
  const validationError = validateWalletChargeAmountKrw(params.amountKrw);
  if (validationError) throw new Error(validationError);

  const pending = await prisma.alimtalkChargeRequest.findFirst({
    where: { tenantId: params.tenantId, status: 'PENDING' },
    select: { id: true },
  });
  if (pending) {
    throw new Error('이미 처리 대기 중인 충전 신청이 있습니다. 승인 후 다시 신청해 주세요.');
  }

  const row = await prisma.alimtalkChargeRequest.create({
    data: {
      tenantId: params.tenantId,
      amountKrw: params.amountKrw,
      memo: params.memo?.trim() || null,
      status: 'PENDING',
      requestedByUserId: params.requestedByUserId,
    },
  });
  void notifyPlatformOps({
    event: 'wallet_charge',
    tenantId: params.tenantId,
    title: '청소비서 지갑 충전 신청',
    body: `${row.amountKrw.toLocaleString('ko-KR')}원`,
    email: false,
  }).catch((err) => console.error('[platform-inbox] wallet charge', err));
  void sendWalletChargeRequestEmails({
    tenantId: params.tenantId,
    chargeRequestId: row.id,
    amountKrw: row.amountKrw,
    memo: row.memo,
    requestedByUserId: params.requestedByUserId,
    requestedAt: row.createdAt.toISOString(),
  }).catch((err) => console.error('[wallet-charge-mail] notify', err));
  return mapChargeRequestDto(row);
}

export type ApproveAlimtalkChargeRequestResult = {
  balanceAfterKrw: number;
  bankPaymentId: string | null;
};

export async function approveAlimtalkChargeRequest(params: {
  tenantId: string;
  chargeRequestId: string;
  actorPlatformUserId?: string | null;
  memo?: string | null;
}): Promise<ApproveAlimtalkChargeRequestResult> {
  const request = await prisma.alimtalkChargeRequest.findFirst({
    where: { id: params.chargeRequestId, tenantId: params.tenantId },
  });
  if (!request) throw new Error('충전 신청을 찾을 수 없습니다.');
  if (request.status !== 'PENDING') {
    throw new Error('이미 처리된 충전 신청입니다.');
  }

  const reason = [params.memo?.trim() || null, request.memo?.trim() || null].filter(Boolean).join(' · ');
  const memo = `cbiseo:paid:${reason || '충전 신청 승인'}`;

  const claimed = await prisma.alimtalkChargeRequest.updateMany({
    where: { id: request.id, tenantId: params.tenantId, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      actorPlatformUserId: params.actorPlatformUserId ?? null,
    },
  });
  if (claimed.count !== 1) throw new Error('이미 처리된 충전 신청입니다.');

  try {
    const topUp = await applyPlatformAlimtalkTopUp({
      tenantId: params.tenantId,
      amountKrw: request.amountKrw,
      memo,
      actorPlatformUserId: params.actorPlatformUserId ?? null,
      revenue: true,
    });
    if (topUp.bankPaymentId) {
      await scheduleIssueForBankWalletPayment(topUp.bankPaymentId);
    }
    return {
      balanceAfterKrw: topUp.balanceAfterKrw,
      bankPaymentId: topUp.bankPaymentId,
    };
  } catch (err) {
    await prisma.alimtalkChargeRequest.updateMany({
      where: { id: request.id, tenantId: params.tenantId, status: 'APPROVED' },
      data: { status: 'PENDING', reviewedAt: null, actorPlatformUserId: null },
    });
    throw err;
  }
}

async function sendWalletChargeRequestEmails(input: {
  tenantId: string;
  chargeRequestId: string;
  amountKrw: number;
  memo: string | null;
  requestedByUserId: string;
  requestedAt: string;
}): Promise<void> {
  const [settings, tenant, requester] = await Promise.all([
    ensurePlatformBillingSettings(),
    prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true, slug: true },
    }),
    prisma.user.findFirst({
      where: { id: input.requestedByUserId, tenantId: input.tenantId },
      select: { name: true, email: true },
    }),
  ]);
  if (!tenant) return;

  const notifyEmails = parsePaymentNotifyEmailsFromSettings(settings);
  if (notifyEmails.length === 0) {
    console.warn('[wallet-charge-mail] no notify emails configured');
    return;
  }

  const requesterName = requester?.name?.trim() || requester?.email || '업체 관리자';
  const mailPayload = {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tenantId: input.tenantId,
    chargeRequestId: input.chargeRequestId,
    supplyAmountKrw: input.amountKrw,
    memo: input.memo,
    requesterName,
    requestedAt: input.requestedAt,
  };

  await Promise.all(
    notifyEmails.map((notifyEmail) =>
      notifyWalletChargeRequestByEmail({ ...mailPayload, notifyEmail }),
    ),
  );
}

export async function upsertTenantAlimtalkTemplateSettings(
  tenantId: string,
  templates: { code: string; enabled: boolean }[],
): Promise<void> {
  for (const t of templates) {
    if (!ALIMTALK_TEMPLATE_CODES.includes(t.code as (typeof ALIMTALK_TEMPLATE_CODES)[number])) {
      continue;
    }
    await prisma.tenantAlimtalkTemplateSetting.upsert({
      where: { tenantId_templateCode: { tenantId, templateCode: t.code } },
      create: { tenantId, templateCode: t.code, isEnabled: t.enabled },
      update: { isEnabled: t.enabled },
    });
  }
}

function mapChargeRequestDto(row: {
  id: string;
  amountKrw: number;
  memo: string | null;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
}): AlimtalkChargeRequestDto {
  return {
    id: row.id,
    amountKrw: row.amountKrw,
    memo: row.memo,
    status: row.status as AlimtalkChargeRequestStatus,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}
