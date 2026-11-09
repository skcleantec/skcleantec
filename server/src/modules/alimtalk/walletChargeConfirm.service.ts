import { prisma } from '../../lib/prisma.js';
import { walletChargePayKrw, walletChargeVatKrw } from '../../lib/alimtalkPolicy.js';
import { approveAlimtalkChargeRequest } from './alimtalkChargeRequest.service.js';
import { verifyWalletChargeConfirmToken } from './walletChargeConfirmToken.js';

export type WalletChargeConfirmPreview = {
  alreadyProcessed: boolean;
  canConfirm: boolean;
  tenantName: string;
  tenantSlug: string;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  payAmountKrw: number;
  memo: string | null;
  requesterName: string | null;
  requestedAt: string;
  status: string;
  message: string;
  balanceAfterKrw: number | null;
  taxInvoiceStatus: 'PENDING' | 'ISSUED' | 'FAILED' | 'SKIPPED' | null;
  taxInvoiceLabel: string | null;
};

export type WalletChargeConfirmResult = WalletChargeConfirmPreview & {
  confirmed: boolean;
};

function taxInvoiceLabel(status: WalletChargeConfirmPreview['taxInvoiceStatus']): string | null {
  if (status === 'ISSUED') return '세금계산서 발행됨';
  if (status === 'PENDING') return '세금계산서 발행 중';
  if (status === 'FAILED') return '세금계산서 발행 실패';
  if (status === 'SKIPPED') return '세금계산서 해당 없음';
  return null;
}

function previewMessage(input: {
  alreadyProcessed: boolean;
  canConfirm: boolean;
  status: string;
}): string {
  if (input.status === 'PENDING' && input.canConfirm) {
    return '입금이 맞다면 아래 버튼으로 지갑을 바로 충전할 수 있습니다.';
  }
  if (input.alreadyProcessed) {
    if (input.status === 'APPROVED') return '이미 처리된 신청입니다.';
    if (input.status === 'REJECTED') return '이미 거절된 신청입니다.';
    if (input.status === 'CANCELLED') return '이미 취소된 신청입니다.';
    return '이미 처리된 신청입니다.';
  }
  return '이 신청은 확인할 수 없는 상태입니다.';
}

async function loadTaxInvoiceByPaymentId(
  paymentId: string | null,
): Promise<{ status: WalletChargeConfirmPreview['taxInvoiceStatus']; label: string | null }> {
  if (!paymentId) return { status: null, label: null };
  const invoice = await prisma.platformWalletInvoice.findUnique({
    where: { paymentId },
    select: { status: true },
  });
  if (!invoice) return { status: 'PENDING', label: taxInvoiceLabel('PENDING') };
  const status = invoice.status as NonNullable<WalletChargeConfirmPreview['taxInvoiceStatus']>;
  return { status, label: taxInvoiceLabel(status) };
}

async function loadTaxInvoiceForTenantAfter(
  tenantId: string,
  after: Date | null,
): Promise<{ status: WalletChargeConfirmPreview['taxInvoiceStatus']; label: string | null }> {
  const invoice = await prisma.platformWalletInvoice.findFirst({
    where: {
      tenantId,
      ...(after ? { createdAt: { gte: new Date(after.getTime() - 60_000) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
  });
  if (!invoice) return { status: null, label: null };
  const status = invoice.status as NonNullable<WalletChargeConfirmPreview['taxInvoiceStatus']>;
  return { status, label: taxInvoiceLabel(status) };
}

export async function previewWalletChargeConfirm(token: string): Promise<WalletChargeConfirmPreview> {
  const payload = verifyWalletChargeConfirmToken(token);
  const request = await prisma.alimtalkChargeRequest.findFirst({
    where: { id: payload.chargeRequestId, tenantId: payload.tenantId },
    select: {
      id: true,
      amountKrw: true,
      memo: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      requestedByUserId: true,
      tenant: { select: { name: true, slug: true } },
    },
  });
  if (!request) {
    throw new Error('확인 링크가 올바르지 않거나 신청을 찾을 수 없습니다.');
  }

  const requester = request.requestedByUserId
    ? await prisma.user.findFirst({
        where: { id: request.requestedByUserId, tenantId: payload.tenantId },
        select: { name: true, email: true },
      })
    : null;

  const supplyAmountKrw = request.amountKrw;
  const vatAmountKrw = walletChargeVatKrw(supplyAmountKrw);
  const payAmountKrw = walletChargePayKrw(supplyAmountKrw);
  const alreadyProcessed = request.status !== 'PENDING';
  const canConfirm = request.status === 'PENDING';

  let balanceAfterKrw: number | null = null;
  let taxStatus: WalletChargeConfirmPreview['taxInvoiceStatus'] = null;
  let taxLabel: string | null = null;
  if (alreadyProcessed && request.status === 'APPROVED') {
    const wallet = await prisma.tenantAlimtalkWallet.findUnique({
      where: { tenantId: payload.tenantId },
      select: { prepaidBalanceKrw: true },
    });
    balanceAfterKrw = wallet?.prepaidBalanceKrw ?? null;
    const tax = await loadTaxInvoiceForTenantAfter(payload.tenantId, request.reviewedAt);
    taxStatus = tax.status;
    taxLabel = tax.label;
  }

  return {
    alreadyProcessed,
    canConfirm,
    tenantName: request.tenant.name,
    tenantSlug: request.tenant.slug,
    supplyAmountKrw,
    vatAmountKrw,
    payAmountKrw,
    memo: request.memo,
    requesterName: requester?.name?.trim() || requester?.email || null,
    requestedAt: request.createdAt.toISOString(),
    status: request.status,
    message: previewMessage({ alreadyProcessed, canConfirm, status: request.status }),
    balanceAfterKrw,
    taxInvoiceStatus: taxStatus,
    taxInvoiceLabel: taxLabel,
  };
}

export async function confirmWalletChargeByEmailToken(token: string): Promise<WalletChargeConfirmResult> {
  const payload = verifyWalletChargeConfirmToken(token);
  const preview = await previewWalletChargeConfirm(token);
  if (preview.alreadyProcessed) {
    return { ...preview, confirmed: false };
  }
  if (!preview.canConfirm) {
    throw new Error(preview.message);
  }

  const approved = await approveAlimtalkChargeRequest({
    tenantId: payload.tenantId,
    chargeRequestId: payload.chargeRequestId,
    actorPlatformUserId: null,
    memo: '메일 승인',
  });

  const tax = await loadTaxInvoiceByPaymentId(approved.bankPaymentId);
  const balanceText = `잔액 ${approved.balanceAfterKrw.toLocaleString('ko-KR')}원`;
  const taxText = tax.label ?? '세금계산서 발행 중';

  return {
    ...preview,
    alreadyProcessed: true,
    canConfirm: false,
    status: 'APPROVED',
    confirmed: true,
    balanceAfterKrw: approved.balanceAfterKrw,
    taxInvoiceStatus: tax.status ?? 'PENDING',
    taxInvoiceLabel: tax.label ?? taxInvoiceLabel('PENDING'),
    message: `충전 완료 · ${balanceText} · ${taxText}`,
  };
}
