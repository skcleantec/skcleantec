import {
  buildPageTokens,
  INQUIRY_LIST_PAGE_SIZE_OPTIONS,
  totalPages,
  type InquiryListPageSize,
} from '../../utils/listPagination';

type ListPaginationBarProps = {
  page: number;
  pageSize: InquiryListPageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: InquiryListPageSize) => void;
  mode?: 'full' | 'summary' | 'nav';
  className?: string;
  compact?: boolean;
};

function ListPaginationSummary({
  total,
  pageSize,
  from,
  to,
  onPageSizeChange,
  compact = false,
}: {
  total: number;
  pageSize: InquiryListPageSize;
  from: number;
  to: number;
  onPageSizeChange: (size: InquiryListPageSize) => void;
  compact?: boolean;
}) {
  const textCls = compact ? 'text-fluid-2xs' : 'text-fluid-xs';
  const selectCls = compact
    ? 'rounded border border-gray-300 bg-white px-1 py-0.5 text-fluid-2xs text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400'
    : 'rounded border border-gray-300 bg-white px-2 py-1 text-fluid-xs text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400';
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${textCls} text-gray-600`}>
      <span>
        총 <span className="font-semibold tabular-nums text-gray-900">{total.toLocaleString('ko-KR')}</span>건
        {total > 0 ? (
          <>
            {' '}
            ·{' '}
            <span className="tabular-nums">
              {from.toLocaleString('ko-KR')}–{to.toLocaleString('ko-KR')}
            </span>
            번째
          </>
        ) : null}
      </span>
      <label className="inline-flex items-center gap-1.5">
        <span className="text-gray-500">페이지당</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10) as InquiryListPageSize)}
          className={selectCls}
          aria-label="페이지당 표시 건수"
        >
          {INQUIRY_LIST_PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}개
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ListPaginationNav({
  safePage,
  tp,
  tokens,
  onPageChange,
}: {
  safePage: number;
  tp: number;
  tokens: ReturnType<typeof buildPageTokens>;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1 sm:justify-end" aria-label="페이지">
      <button
        type="button"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        className="min-w-[2.25rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-xs text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="이전 페이지"
      >
        &lt;
      </button>
      {tokens.map((tok, i) =>
        tok === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1 text-fluid-xs text-gray-400" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={tok}
            type="button"
            onClick={() => onPageChange(tok)}
            aria-current={tok === safePage ? 'page' : undefined}
            className={`min-w-[2.25rem] rounded border px-2 py-1.5 text-fluid-xs tabular-nums ${
              tok === safePage
                ? 'border-gray-800 bg-gray-800 font-semibold text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tok}
          </button>
        )
      )}
      <button
        type="button"
        disabled={safePage >= tp}
        onClick={() => onPageChange(safePage + 1)}
        className="min-w-[2.25rem] rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-xs text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="다음 페이지"
      >
        &gt;
      </button>
    </nav>
  );
}

export function ListPaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  mode = 'full',
  className = '',
  compact = false,
}: ListPaginationBarProps) {
  const tp = totalPages(total, pageSize);
  const safePage = Math.min(Math.max(1, page), tp);
  const tokens = buildPageTokens(safePage, tp);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = total === 0 ? 0 : Math.min(safePage * pageSize, total);

  if (mode === 'summary') {
    return (
      <ListPaginationSummary
        total={total}
        pageSize={pageSize}
        from={from}
        to={to}
        onPageSizeChange={onPageSizeChange}
        compact={compact}
      />
    );
  }

  if (mode === 'nav') {
    return (
      <div
        className={`flex flex-col gap-3 border-t border-gray-200 bg-gray-50/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-center ${className}`}
      >
        <ListPaginationNav safePage={safePage} tp={tp} tokens={tokens} onPageChange={onPageChange} />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 border-t border-gray-200 bg-gray-50/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      <ListPaginationSummary
        total={total}
        pageSize={pageSize}
        from={from}
        to={to}
        onPageSizeChange={onPageSizeChange}
        compact={compact}
      />
      <ListPaginationNav safePage={safePage} tp={tp} tokens={tokens} onPageChange={onPageChange} />
    </div>
  );
}
