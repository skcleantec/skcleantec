import type { InquiryDbListingMeta } from '../../api/dbMarketplace';

export type { InquiryDbListingMeta };

type Props = {
  dbListing: InquiryDbListingMeta;
  className?: string;
  compact?: boolean;
  /** 스케줄 등 — 장바구니 아이콘만, 툴팁에 상태 */
  iconOnly?: boolean;
};

const STATUS_LABEL: Record<InquiryDbListingMeta['status'], string> = {
  DRAFT: '정보공유 장바구니',
  OPEN: '정보공유 게시',
  PENDING_SELLER: '정보공유 인계대기',
  CONFIRMED: '정보공유 확정',
  EXPIRED: '정보공유 만료',
};

function statusColorClass(status: InquiryDbListingMeta['status']): string {
  if (status === 'PENDING_SELLER') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'CONFIRMED') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'OPEN') return 'border-sky-200 bg-sky-50 text-sky-900';
  if (status === 'EXPIRED') return 'border-gray-200 bg-gray-50 text-gray-600';
  return 'border-violet-200 bg-violet-50 text-violet-900';
}

function ShoppingCartIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      width={14}
      height={14}
    >
      <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a1 1 0 00.98.804H13a1 1 0 00.98-.804L14.78 3H17a1 1 0 100-2H3zm1.22 5l-.512 2.048A2 2 0 004.8 10h8.4a2 2 0 001.992-1.952L14.68 6H4.22zM6 14a2 2 0 104 0 2 2 0 00-4 0zm6 0a2 2 0 104 0 2 2 0 00-4 0z" />
    </svg>
  );
}

export function InquiryDbMarketplaceBadge({
  dbListing,
  className = '',
  compact = false,
  iconOnly = false,
}: Props) {
  const label = STATUS_LABEL[dbListing.status];
  const colorClass = statusColorClass(dbListing.status);

  if (iconOnly) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded border p-0.5 ${colorClass} ${className}`}
        title={label}
        aria-label={label}
      >
        <ShoppingCartIcon />
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
