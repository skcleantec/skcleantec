import type { InquiryDbListingMeta } from '../../api/dbMarketplace';

export type { InquiryDbListingMeta };

type Props = {
  dbListing: InquiryDbListingMeta;
  className?: string;
  compact?: boolean;
};

const STATUS_LABEL: Record<InquiryDbListingMeta['status'], string> = {
  DRAFT: '정보공유 장바구니',
  OPEN: '정보공유 게시',
  PENDING_SELLER: '정보공유 인계대기',
  CONFIRMED: '정보공유 확정',
  EXPIRED: '정보공유 만료',
};

export function InquiryDbMarketplaceBadge({ dbListing, className = '', compact = false }: Props) {
  const label = STATUS_LABEL[dbListing.status];
  const urgent = dbListing.status === 'PENDING_SELLER';

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-fluid-2xs ${
        urgent
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-violet-200 bg-violet-50 text-violet-900'
      } ${className}`}
      title={compact ? label : undefined}
    >
      <span className="truncate">{compact ? label.replace('정보공유 ', '') : label}</span>
    </span>
  );
}
