import type { PlatformCoinUsageRow } from '../../api/platformCoinUsage';

function kstYmd(iso: string): { y: number; m: number; d: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { y: num('year'), m: num('month'), d: num('day') };
}

/** 올해면 M. D. 올해가 아니면 YY. M. D. */
export function formatSignupDay(iso: string, now: Date = new Date()): string {
  const day = kstYmd(iso);
  const today = kstYmd(now.toISOString());
  if (!day || !today) return '';
  if (day.y === today.y) return `${day.m}. ${day.d}.`;
  return `${String(day.y).slice(-2)}. ${day.m}. ${day.d}.`;
}

function formatMonthDay(iso: string): string {
  const day = kstYmd(iso);
  if (!day) return '';
  return `${day.m}. ${day.d}.`;
}

function formatFullDay(iso: string): string {
  const day = kstYmd(iso);
  if (!day) return '';
  return `${day.y}. ${day.m}. ${day.d}.`;
}

export function TenantSignupLine({ row, align = 'center' }: { row: PlatformCoinUsageRow; align?: 'center' | 'start' }) {
  if (!row.createdAt) return null;
  const label = formatSignupDay(row.createdAt);
  if (!label) return null;
  return (
    <div
      className={`mt-0.5 flex flex-wrap items-center gap-1 text-fluid-2xs text-gray-400 ${
        align === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      {row.newSignup ? (
        <span className="rounded-full bg-sky-50 px-1.5 text-[10px] font-semibold text-sky-700">신규</span>
      ) : null}
      <span>가입 {label}</span>
    </div>
  );
}

export function EventTrialBadge({ row }: { row: PlatformCoinUsageRow }) {
  if (!row.eventTrialActive || !row.eventEndsAt) return null;
  const short = formatMonthDay(row.eventEndsAt);
  const full = formatFullDay(row.eventEndsAt);
  if (!short || !full) return null;
  const title = `${row.eventName ? `${row.eventName} · ` : ''}체험 종료 ${full}`;
  return (
    <span
      title={title}
      className="ml-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
    >
      이벤트 ~{short}
    </span>
  );
}
