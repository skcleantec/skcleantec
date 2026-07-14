export const STATUS_LABEL: Record<string, string> = {
  TRIAL: '체험',
  ACTIVE: '운영',
  SUSPENDED: '중지',
};

export const BTN_PRIMARY =
  'px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40';
export const BTN_SECONDARY =
  'px-4 py-2 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40';
export const BTN_DANGER =
  'px-4 py-2 bg-white text-red-600 text-sm font-medium border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40';
export const BTN_DANGER_SOLID =
  'px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40';
export const BTN_LINK = 'text-sm text-blue-600 hover:underline';
export const CARD_SECTION = 'bg-white border border-gray-200 rounded-xl p-5 space-y-4';
export const INPUT_BASE =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20';

const BADGE_BASE = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium';
const DOT_BASE = 'w-1.5 h-1.5 rounded-full shrink-0';

export function getPlanBadgeClass(plan: string): string {
  const p = plan.toLowerCase();
  if (p === 'premium') return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200';
  if (p === 'standard') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
}

export function getStatusBadgeClass(status: string): { badge: string; dot: string } {
  if (status === 'ACTIVE') return { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
  if (status === 'TRIAL') return { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' };
  return { badge: 'bg-red-50 text-red-600', dot: 'bg-red-400' };
}

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize ${getPlanBadgeClass(plan)}`}>
      {plan}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { badge, dot } = getStatusBadgeClass(status);
  return (
    <span className={`${BADGE_BASE} ${badge}`}>
      <span className={`${DOT_BASE} ${dot}`} aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const OPERATIONAL_BADGE: Record<string, string> = {
  TRIAL_PAID: 'bg-sky-50 text-sky-800',
  TRIAL_UNPAID: 'bg-amber-50 text-amber-800',
  PENDING_START: 'bg-violet-50 text-violet-800',
  ACTIVE_OK: 'bg-emerald-50 text-emerald-700',
  ACTIVE_UNPAID_SCHEDULED: 'bg-amber-50 text-amber-800',
  ACTIVE_BILLED: 'bg-amber-50 text-amber-800',
  ACTIVE_OVERDUE: 'bg-rose-50 text-rose-700',
  ACTIVE_BLOCKED: 'bg-rose-100 text-rose-800',
  SUSPENDED: 'bg-red-50 text-red-600',
  SETUP_REQUIRED: 'bg-slate-100 text-slate-700',
};

export function BillingOperationalBadge({
  label,
  detail,
  code,
}: {
  label: string;
  detail?: string | null;
  code?: string;
}) {
  const cls = (code && OPERATIONAL_BADGE[code]) || 'bg-slate-100 text-slate-700';
  return (
    <span className={`${BADGE_BASE} ${cls}`} title={detail ?? undefined}>
      {label}
      {detail ? <span className="font-normal opacity-80"> · {detail}</span> : null}
    </span>
  );
}

export function PlatformAlert({ message, variant }: { message: string; variant: 'success' | 'error' }) {
  if (variant === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <span aria-hidden>✓</span>
        {message}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
      <span aria-hidden>!</span>
      {message}
    </div>
  );
}

export function PlatformToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none',
        checked ? 'bg-blue-600' : 'bg-gray-200',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}
