import type { DbMarketplaceListingDetail } from '../../api/dbMarketplace';
import { marketplaceAmountSummaryRows } from '../db-marketplace/DbMarketplaceAmountSummary';
import { DbMarketplaceDetailKeyValueTable } from '../db-marketplace/DbMarketplaceDetailKeyValueTable';

/** 정보공유 상세 — 판매·금액·고객 요약 (구매 전) */
export function DbMarketplaceListingSummaryCard({ row }: { row: DbMarketplaceListingDetail }) {
  const rows = [
    { label: '판매 업체', value: row.sellerTenantName },
    ...marketplaceAmountSummaryRows({
      serviceTotalAmount: row.serviceTotalAmount ?? row.inquiryFull?.serviceTotalAmount,
      serviceDepositAmount: row.serviceDepositAmount ?? row.inquiryFull?.serviceDepositAmount,
      customerBalanceAmount: row.customerBalanceAmount,
      displayAmount: row.displayAmount,
      listingFee: row.listingFee,
      priorFeesTotal: row.priorFeesTotal,
      buyerTotalFee: row.buyerTotalFee,
    }),
    {
      label: '고객',
      value: `${row.customerNameMasked} · ${row.addressRegion}`,
    },
  ];

  if (row.buyerName) {
    rows.push({ label: '구매 신청', value: row.buyerName });
  }

  return <DbMarketplaceDetailKeyValueTable rows={rows} tone="slate" />;
}
