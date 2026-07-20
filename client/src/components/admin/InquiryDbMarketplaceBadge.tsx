import type { InquiryDbListingMeta } from '../../api/dbMarketplace';

export type { InquiryDbListingMeta };

const DB_MARKETPLACE_CART_ICON = '/icons/db-marketplace-cart.png';

type Props = {
  dbListing: InquiryDbListingMeta;
  className?: string;
  compact?: boolean;
  /** 스케줄 등 — 장바구니(DRAFT)는 아이콘만, 그 외는 compact 뱃지 */
  iconOnly?: boolean;
};

const STATUS_LABEL: Record<InquiryDbListingMeta['status'], string> = {
  DRAFT: '정보공유 장바구니',
  OPEN: '정보공유 게시',
  PENDING_SELLER: '정보공유 인계대기',
  CONFIRMED: '정보공유 확정',
  EXPIRED: '정보공유 만료',
};

export function isDbMarketplaceCartDraft(
  dbListing: InquiryDbListingMeta | null | undefined,
): dbListing is InquiryDbListingMeta {
  return dbListing?.status === 'DRAFT';
}

function DbMarketplaceCartIcon({ className = '' }: { className?: string }) {
  return (
    <img
      src={DB_MARKETPLACE_CART_ICON}
      alt=""
      width={16}
      height={16}
      className={`h-4 w-4 shrink-0 object-contain ${className}`}
      draggable={false}
    />
  );
}

export function InquiryDbMarketplaceBadge({
  dbListing,
  className = '',
  compact = false,
  iconOnly = false,
}: Props) {
  const label = STATUS_LABEL[dbListing.status];

  if (dbListing.status === 'DRAFT') {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        title={label}
        aria-label={label}
      >
        <DbMarketplaceCartIcon />
      </span>
    );
  }

  if (iconOnly) {
    return (
      <span
        className={`inline-flex max-w-full shrink-0 items-center rounded border border-violet-200 bg-violet-50 px-1 py-px text-[9px] font-medium leading-tight text-violet-900 sm:text-fluid-2xs ${className}`}
        title={label}
        aria-label={label}
      >
        <span className="truncate">{label.replace('정보공유 ', '')}</span>
      </span>
    );
  }

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
