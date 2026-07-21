import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { children?: ReactNode };

export const MARKETPLACE_STATUS_LABEL: Record<string, string> = {
  DRAFT: '장바구니',
  OPEN: '게시 중',
  PENDING_SELLER: '인계 대기',
  CONFIRMED: '확정 완료',
  WITHDRAWN: '철회',
  EXPIRED: '만료',
};

export const MARKETPLACE_STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  OPEN: 'bg-sky-100 text-sky-800',
  PENDING_SELLER: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  WITHDRAWN: 'bg-gray-200 text-gray-600',
  EXPIRED: 'bg-gray-100 text-gray-700',
};

export function DbMarketplaceStatusBadge({
  status,
  compact = false,
}: {
  status: keyof typeof MARKETPLACE_STATUS_LABEL | string;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full font-medium ${
        compact ? 'px-1.5 py-0 text-fluid-2xs' : 'px-2 py-0.5 text-[11px]'
      } ${MARKETPLACE_STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-700'}`}
    >
      {MARKETPLACE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function MarketplaceActionButton({ className, children, ...rest }: BtnProps & { className: string }) {
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  );
}

export const marketplacePublishBulkButtonClass =
  'min-h-[2.75rem] flex-1 rounded-lg bg-violet-700 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50 sm:min-h-0 sm:flex-none sm:px-4';

export const marketplaceRevertBulkButtonClass =
  'min-h-[2.75rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 sm:min-h-0 sm:flex-none';

export const marketplaceBuyBulkButtonClass =
  'min-h-[2.75rem] flex-1 rounded-lg bg-violet-700 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50 sm:min-h-0 sm:flex-none';

export const marketplaceConfirmBulkButtonClass =
  'min-h-[2.75rem] flex-1 rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0 sm:flex-none';

export const marketplaceDeclineBulkButtonClass =
  'min-h-[2.75rem] flex-1 rounded-lg border border-amber-300 px-4 py-2 text-fluid-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 sm:min-h-0 sm:flex-none';

export const marketplaceCartAddButtonClass =
  'rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-50';

export const marketplaceRevertToCartButtonClass =
  'min-h-[2.75rem] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 sm:min-h-0 sm:flex-none';

export function DbMarketplacePublishBulkButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplacePublishBulkButtonClass} {...props}>
      <span className="sm:hidden">노출 지정 · 게시</span>
      <span className="hidden sm:inline">노출 업체 지정 · 게시하기</span>
    </MarketplaceActionButton>
  );
}

export function DbMarketplaceRevertBulkButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplaceRevertBulkButtonClass} {...props}>
      원상복귀
    </MarketplaceActionButton>
  );
}

export function DbMarketplaceBuyBulkButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplaceBuyBulkButtonClass} {...props}>
      갖고가기
    </MarketplaceActionButton>
  );
}

export function DbMarketplaceConfirmBulkButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplaceConfirmBulkButtonClass} {...props}>
      인계 확정
    </MarketplaceActionButton>
  );
}

export function DbMarketplaceDeclineBulkButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplaceDeclineBulkButtonClass} {...props}>
      구매 신청 거절
    </MarketplaceActionButton>
  );
}

export function DbMarketplaceCartAddButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplaceCartAddButtonClass} {...props}>
      장바구니 담기
    </MarketplaceActionButton>
  );
}

export function DbMarketplaceRevertToCartButton(props: BtnProps) {
  return (
    <MarketplaceActionButton className={marketplaceRevertToCartButtonClass} {...props}>
      장바구니로 되돌리기
    </MarketplaceActionButton>
  );
}
