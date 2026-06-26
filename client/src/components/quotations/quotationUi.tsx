import type { QuotationStatus } from '../../api/quotations';

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: '작성 중',
  FINALIZED: '확정',
  SENT: '발송됨',
};

const STATUS_BADGE: Record<QuotationStatus, string> = {
  DRAFT:
    'inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-fluid-2xs font-semibold text-slate-600 ring-1 ring-slate-200/80',
  FINALIZED:
    'inline-flex rounded-full bg-indigo-50 px-2.5 py-0.5 text-fluid-2xs font-semibold text-indigo-700 ring-1 ring-indigo-700/10',
  SENT:
    'inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-fluid-2xs font-semibold text-emerald-700 ring-1 ring-emerald-700/10',
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus | string }) {
  const key = status as QuotationStatus;
  const label = QUOTATION_STATUS_LABEL[key] ?? status;
  const cls = STATUS_BADGE[key] ?? STATUS_BADGE.DRAFT;
  return <span className={cls}>{label}</span>;
}

export const qUi = {
  pageRoot: 'min-w-0 max-w-6xl mx-auto px-4 py-6 space-y-6',
  pageRootNarrow: 'min-w-0 max-w-4xl mx-auto px-4 py-6 space-y-6',
  breadcrumb: 'text-fluid-xs text-slate-500',
  breadcrumbLink: 'hover:text-slate-800 underline-offset-2 hover:underline',
  pageTitle: 'text-xl sm:text-2xl font-semibold tracking-tight text-slate-900',
  pageDesc: 'text-fluid-sm text-slate-600 mt-1 max-w-2xl',
  card: 'rounded-2xl border border-slate-200/60 bg-white shadow-sm shadow-slate-100/50 min-w-0 overflow-hidden',
  cardBody: 'rounded-2xl border border-slate-200/60 bg-white shadow-sm shadow-slate-100/50 p-4 sm:p-5',
  sectionTitle: 'text-base font-semibold text-slate-900',
  sectionSubtitle: 'text-fluid-xs font-medium text-slate-500',
  label: 'block text-fluid-xs font-medium text-slate-600 mb-1',
  input:
    'w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-fluid-sm text-slate-900 placeholder:text-slate-400',
  textarea:
    'w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-fluid-sm text-slate-900 placeholder:text-slate-400',
  select:
    'w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-fluid-sm text-slate-900',
  btnPrimary:
    'inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50',
  btnSecondary:
    'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50',
  btnGhost:
    'inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50',
  btnDanger:
    'inline-flex items-center justify-center rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50',
  btnSuccess:
    'inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50',
  btnChip:
    'inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-fluid-2xs font-semibold text-slate-700 shadow-sm transition-transform hover:bg-slate-50 hover:scale-[1.03] disabled:opacity-40',
  filterBar: 'border-b border-slate-100 bg-slate-50/80 px-4 py-4 space-y-4',
  segmentWrap: 'inline-flex rounded-lg border border-slate-200 overflow-hidden text-fluid-sm shrink-0',
  segmentBtn: (active: boolean, bordered: boolean) =>
    [
      'px-3 py-1.5 font-medium transition-colors',
      bordered ? 'border-l border-slate-200' : '',
      active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50',
    ].join(' '),
  alertError: 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-fluid-sm text-rose-900',
  alertInfo: 'rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-2.5 text-fluid-sm text-sky-900',
  emptyState: 'px-4 py-12 text-center text-fluid-sm text-slate-500',
  table: 'w-full text-fluid-sm',
  th: 'px-3 py-2.5 text-center font-semibold text-slate-600 bg-slate-50/90',
  td: 'px-3 py-2.5 text-center text-slate-700',
  tr: 'border-t border-slate-100 hover:bg-slate-50/60 transition-colors',
  mobileCard:
    'rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm shadow-slate-100/40 hover:shadow-md transition-shadow',
  modalOverlay:
    'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4',
  modalPanel:
    'relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-slate-200/60',
  modalHeader: 'border-b border-slate-100 px-4 pb-3 pt-4 pr-12',
  modalFooter: 'flex justify-end gap-2 border-t border-slate-100 px-4 py-3',
  stickyActionBar:
    'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
  /** 팀·모바일 견적 하단 고정 바 여백 */
  stickyActionBarSpacer: 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-24',
} as const;
