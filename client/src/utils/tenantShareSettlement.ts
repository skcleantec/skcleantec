import type { TenantInquiryShareMeta } from '../api/tenantInquiryShare';
import { computeMarketplaceServiceBalanceAmount } from '@shared/dbMarketplaceAmount';
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

export function isActiveNativePartnerShareSource(
  share: TenantInquiryShareMeta | null | undefined,
): boolean {
  if (!share || share.syncStatus !== 'ACTIVE' || share.role !== 'SOURCE') return false;
  return share.settlementMode == null || share.settlementMode === 'PARTNER_NATIVE';
}

export function isExternalLegacyShareSource(
  share: TenantInquiryShareMeta | null | undefined,
): boolean {
  if (!share || share.syncStatus !== 'ACTIVE' || share.role !== 'SOURCE') return false;
  return share.settlementMode === 'EXTERNAL_LEGACY';
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
  partnerFeeLabel: string;
  sourceLinkedHint: string | null;
} {
  const plain = resolveCollectibleBaseBalance(
    serviceTotalAmount,
    serviceDepositAmount,
    serviceBalanceAmount,
  );

  if (!isActiveTenantShare(tenantShare)) {
    return {
      baseBalance: plain,
      showPartnerFeeRow: false,
      partnerFee: 0,
      partnerFeeLabel: '파트너 수수료',
      sourceLinkedHint: null,
    };
  }

  if (tenantShare.role === 'SOURCE') {
    return {
      baseBalance: 0,
      showPartnerFeeRow: false,
      partnerFee: truncWon(tenantShare.transferFee),
      partnerFeeLabel: tenantShare.viaMarketplace ? '정보공유 수수료' : '파트너 수수료',
      sourceLinkedHint:
        mode === 'team'
          ? '파트너 연계 — 현장 수금 없음'
          : '파트너 연계 — 현장 수금 없음 (수수료는 파트너 정산 메뉴)',
    };
  }

  const fee = truncWon(tenantShare.transferFee);
  const viaMarketplace = Boolean(tenantShare.viaMarketplace);
  const adjusted = viaMarketplace
    ? computeMarketplaceServiceBalanceAmount({
        serviceTotalAmount,
        serviceDepositAmount,
        serviceBalanceAmount,
      }) ?? plain
    : computeTargetMirrorBalanceAmount({
        serviceTotalAmount,
        serviceDepositAmount,
        serviceBalanceAmount,
        transferFee: fee,
      }) ?? plain;

  return {
    baseBalance: adjusted,
    showPartnerFeeRow: fee > 0 && (mode === 'admin' || viaMarketplace),
    partnerFee: fee,
    partnerFeeLabel: viaMarketplace ? '정보공유 수수료' : '파트너 수수료',
    sourceLinkedHint: null,
  };
}

export { formatPartnerAssignmentLabel } from './scheduleAssigneeDisplay';
