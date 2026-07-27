import type { TenantInquiryShareMeta } from '../../api/tenantInquiryShare';

export type MarketplaceHandoffBuyerDisplay = {
  sellerTenantName: string;
  buyerTotalFee: number;
};

export function marketplaceHandoffFromShare(
  share: TenantInquiryShareMeta | null | undefined,
): MarketplaceHandoffBuyerDisplay | null {
  if (!share || share.role !== 'TARGET' || !share.viaMarketplace) return null;
  const seller = share.partnerName?.trim();
  if (!seller) return null;
  const fee =
    share.transferFee != null && Number.isFinite(share.transferFee)
      ? Math.trunc(share.transferFee)
      : 0;
  return { sellerTenantName: seller, buyerTotalFee: fee };
}

function formatFee(won: number): string {
  return `${won.toLocaleString('ko-KR')}원`;
}

/** 정보공유 구매(인계) — 구매 업체 접수 수정 상단 안내 */
export function MarketplaceHandoffBuyerBanner({
  meta,
  className = '',
  compact = false,
}: {
  meta: MarketplaceHandoffBuyerDisplay;
  className?: string;
  compact?: boolean;
}) {
  const seller = meta.sellerTenantName.trim();
  const feeText = formatFee(meta.buyerTotalFee);

  if (compact) {
    return (
      <p
        className={`rounded-lg border border-violet-200 bg-violet-50/80 px-2 py-1.5 text-fluid-2xs leading-snug text-violet-950 ${className}`}
      >
        <span className="font-semibold">정보공유 구매</span>
        <span className="text-violet-800">
          {' '}
          · {seller} · 수수료 {feeText}
        </span>
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-lg bg-violet-600 px-3 py-1.5 text-fluid-xs font-semibold text-white shadow-sm">
          정보공유 구매
        </span>
        <span className="text-fluid-xs font-semibold text-violet-950">{seller}</span>
        <span className="text-fluid-2xs text-violet-800">판매 업체</span>
      </div>
      <p className="mt-2 text-fluid-sm tabular-nums font-semibold text-violet-950">
        구매 수수료 {feeText}
      </p>
      <p className="mt-1 text-fluid-2xs leading-snug text-violet-900/85">
        위 업체에서 정보공유(마켓)로 인수한 접수입니다. 수수료는 정산·결제 금액 내역에 반영됩니다.
      </p>
    </div>
  );
}
