import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const INQUIRY_DATE_PRESETS = [
  { id: 'today', label: '당일' },
  { id: 'all', label: '전체' },
  { id: 'month', label: '월별' },
  { id: 'day', label: '날짜' },
] as const;

export type InquiryDatePresetId = (typeof INQUIRY_DATE_PRESETS)[number]['id'];

export function InquiryDatePresetBar({
  active = 'today',
  onSelect,
}: {
  active?: InquiryDatePresetId;
  onSelect?: (id: InquiryDatePresetId) => void;
  /** @deprecated 항상 컴팩트 스타일 */
  compact?: boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-fluid-2xs">
      {INQUIRY_DATE_PRESETS.map((opt, idx) => (
        <button
          key={opt.id}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(opt.id)}
          className={`px-2 py-0.5 font-medium ${idx > 0 ? 'border-l border-slate-200' : ''} ${
            active === opt.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const inquiryManualIntakeButtonClass =
  'inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50';

export function InquiryManualIntakeButton({
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { children?: ReactNode }) {
  return (
    <button type="button" className={inquiryManualIntakeButtonClass} {...props}>
      {children ?? null}
      수동접수
    </button>
  );
}

export const inquiryMarketerDailyButtonClass =
  'rounded border border-slate-300 bg-white px-2 py-0.5 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50';

export function InquiryMarketerDailyButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className={inquiryMarketerDailyButtonClass} {...props}>
      내역
    </button>
  );
}

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '예약완료',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
};

export const INQUIRY_STATUS_ICONS: Record<string, string> = {
  PENDING: '🕒',
  RECEIVED: '📝',
  DEPOSIT_PENDING: '💰',
  DEPOSIT_COMPLETED: '✅',
  ORDER_FORM_PENDING: '🔗',
  ASSIGNED: '📌',
  IN_PROGRESS: '🚚',
  COMPLETED: '🏁',
  ON_HOLD: '⏸️',
  CANCELLED: '🛑',
};

/** 목록 상태 칩 — StatusQuickPicker 트리거와 동일한 compact 스타일 */
export function InquiryStatusChipPreview({ status }: { status: keyof typeof INQUIRY_STATUS_LABELS | string }) {
  const label = INQUIRY_STATUS_LABELS[status] ?? status;
  const icon = INQUIRY_STATUS_ICONS[status] ?? '🏷️';
  return (
    <span className="inline-flex items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-fluid-2xs text-slate-700">
      <span className="flex items-center gap-1 whitespace-nowrap font-medium">
        <span aria-hidden>{icon}</span>
        {label}
      </span>
      <span aria-hidden className="text-slate-400">
        ▾
      </span>
    </span>
  );
}

export const inquiryMobileCallButtonClass =
  'inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-3.5 py-2 text-fluid-xs font-semibold text-white shadow-sm shadow-indigo-600/10';

export function InquiryMobileCallButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className={inquiryMobileCallButtonClass} {...props}>
      전화
    </button>
  );
}

export function InquiryOrderPendingHint() {
  return (
    <span className="text-fluid-2xs text-slate-500" title="발주서 목록과 동일: 고객 제출 전">
      발주서 · 미제출
    </span>
  );
}

export function InquiryListPinHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-fluid-2xs font-medium text-amber-900 ring-1 ring-amber-200">
      {children}
    </span>
  );
}
