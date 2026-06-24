import type { ButtonHTMLAttributes } from 'react';

export const USER_REGISTER_TABS = [
  { id: 'leader', label: '팀장' },
  { id: 'marketer', label: '마케터' },
  { id: 'office', label: '사무직' },
  { id: 'resigned', label: '퇴사자' },
] as const;

export type UserRegisterTabId = (typeof USER_REGISTER_TABS)[number]['id'];

export function UserRegisterTabBar({
  active = 'leader',
  onSelect,
}: {
  active?: UserRegisterTabId;
  onSelect?: (id: UserRegisterTabId) => void;
}) {
  return (
    <nav
      className="inline-flex flex-nowrap gap-1 overflow-x-auto rounded-t-md border border-gray-200 border-b-0 bg-gray-50/60 px-2 pt-2 text-fluid-sm"
      role="tablist"
      aria-label="사용자 등록 구분"
    >
      {USER_REGISTER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          disabled={!onSelect}
          aria-selected={active === tab.id}
          onClick={() => onSelect?.(tab.id)}
          className={`shrink-0 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 min-h-[44px] ${
            active === tab.id
              ? 'border-blue-600 bg-white font-semibold text-blue-900'
              : 'border-transparent text-gray-600'
          }`}
        >
          {tab.label}
          <span className="ml-1.5 font-normal tabular-nums text-gray-500">(0)</span>
        </button>
      ))}
    </nav>
  );
}

export const PAYROLL_TABS = [
  { id: 'pool', label: '팀원' },
  { id: 'inout', label: '수입·지출' },
  { id: 'leader', label: '팀장' },
  { id: 'marketer', label: '마케터' },
  { id: 'office', label: '사무직' },
  { id: 'settlement', label: '정산' },
  { id: 'unsettled', label: '미정산현황' },
] as const;

export type PayrollTabId = (typeof PAYROLL_TABS)[number]['id'];

export function PayrollTabBar({
  active = 'leader',
  onSelect,
}: {
  active?: PayrollTabId;
  onSelect?: (id: PayrollTabId) => void;
}) {
  return (
    <nav
      className="inline-flex flex-nowrap gap-1 overflow-x-auto rounded-t-md border border-gray-200 border-b-0 bg-gray-50/60 px-2 pt-2 text-fluid-sm"
      role="tablist"
      aria-label="월정산표 구분"
    >
      {PAYROLL_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          disabled={!onSelect}
          aria-selected={active === tab.id}
          onClick={() => onSelect?.(tab.id)}
          className={`shrink-0 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 min-h-[44px] ${
            active === tab.id
              ? 'border-blue-600 bg-white font-semibold text-blue-900'
              : 'border-transparent text-gray-600'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function MarketerAdminLevelBadge({ level }: { level: 'LIMITED' | 'FULL' }) {
  const cls = level === 'FULL' ? 'bg-blue-100 text-blue-800' : 'bg-sky-100 text-sky-800';
  const label = level === 'FULL' ? '전체' : '일부';
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>
  );
}

export function TeamLeaderDayOffBulkButton({
  variant,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { variant: 'allow' | 'deny' }) {
  const cls =
    variant === 'allow'
      ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
      : 'border-gray-300 text-gray-700 bg-white';
  return (
    <button
      type="button"
      className={`rounded border px-3 py-1.5 text-fluid-xs font-medium ${cls}`}
      {...props}
    >
      {variant === 'allow' ? '휴무 일괄 허용' : '일괄 금지'}
    </button>
  );
}
