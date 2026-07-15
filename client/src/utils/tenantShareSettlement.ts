import type { TenantInquiryShareMeta } from '../api/tenantInquiryShare';
import { resolveCollectibleBaseBalance } from './inquiryCollectibleAmount';

function truncWon(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(Number(v))) return 0;
  return Math.trunc(Number(v));
}

export function computeTargetMirrorBalanceAmount(opts: {
  serviceTotalAmount: number | null | undefined;
  serviceDepositAmount: number | null | undefined;
  serviceBalanceAmount: number | null | undefined;
  transferFee: number | null | undefined;
}): number | null {
  const fee = truncWon(opts.transferFee);
  const total = opts.serviceTotalAmount;
  if (total != null && Number.isFinite(Number(total))) {
    const deposit = truncWon(opts.serviceDepositAmount);
    return Math.max(0, truncWon(total) - deposit - fee);
  }
  const balance = opts.serviceBalanceAmount;
  if (balance != null && Number.isFinite(Number(balance))) {
    return Math.max(0, truncWon(balance) - fee);
  }
  return null;
}

export function isActiveTenantShare(
  share: TenantInquiryShareMeta | null | undefined,
): share is TenantInquiryShareMeta {
  return Boolean(share && share.syncStatus === 'ACTIVE');
}

export function isActivePartnerShareSource(
  share: TenantInquiryShareMeta | null | undefined,
): boolean {
  return isActiveTenantShare(share) && share.role === 'SOURCE';
}

/** 결제 금액 내역 — 파트너 연계 반영 잔금 */
export function resolveTenantShareCollectibleBaseBalance(
  serviceTotalAmount: number | null | undefined,
  serviceDepositAmount: number | null | undefined,
  serviceBalanceAmount: number | null | undefined,
  tenantShare: TenantInquiryShareMeta | null | undefined,
  mode: 'team' | 'admin',
): {
  baseBalance: number | null;
  showPartnerFeeRow: boolean;
  partnerFee: number;
  sourceLinkedHint: string | null;
} {
  const plain = resolveCollectibleBaseBalance(
    serviceTotalAmount,
    serviceDepositAmount,
    serviceBalanceAmount,
  );

  if (!isActiveTenantShare(tenantShare)) {
    return { baseBalance: plain, showPartnerFeeRow: false, partnerFee: 0, sourceLinkedHint: null };
  }

  if (tenantShare.role === 'SOURCE') {
    return {
      baseBalance: 0,
      showPartnerFeeRow: false,
      partnerFee: truncWon(tenantShare.transferFee),
      sourceLinkedHint:
        mode === 'team'
          ? '파트너 연계 — 현장 수금 없음'
          : '파트너 연계 — 현장 수금 없음 (수수료는 파트너 정산 메뉴)',
    };
  }

  const fee = truncWon(tenantShare.transferFee);
  const adjusted =
    computeTargetMirrorBalanceAmount({
      serviceTotalAmount,
      serviceDepositAmount,
      serviceBalanceAmount,
      transferFee: fee,
    }) ?? plain;

  return {
    baseBalance: adjusted,
    showPartnerFeeRow: mode === 'admin' && fee > 0,
    partnerFee: fee,
    sourceLinkedHint: null,
  };
}

export { formatPartnerAssignmentLabel } from './scheduleAssigneeDisplay';
