import type { CrmQuickScheduleKind } from '../../../api/crmQuickSchedule';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const dt = new Date(`${ymd}T12:00:00+09:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function dayDiff(todayYmd: string, ymd: string): number | null {
  const a = parseYmd(todayYmd);
  const b = parseYmd(ymd);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatQuickMonthDay(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  const label = dt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });
  const m = dt.toLocaleString('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' });
  const d = dt.toLocaleString('en-US', { timeZone: 'Asia/Seoul', day: 'numeric' });
  const weekday = WEEKDAY[dt.getDay()] ?? label;
  return `${m}. ${d}. (${weekday})`;
}

export function quickWhenBadge(
  kind: CrmQuickScheduleKind,
  ymd: string | null,
  todayYmd: string,
): { text: string; tone: 'orange' | 'rose' | 'amber' | 'slate' } {
  if (kind === 'ASAP') return { text: '가장 빠른 일정', tone: 'orange' };
  if (kind === 'WITHIN_WEEK' && ymd) {
    return { text: `일주일 이내 · ~${formatQuickMonthDay(ymd).replace(/\s*\(.+\)$/, '')}`, tone: 'amber' };
  }
  if (kind === 'DATE' && ymd) {
    const diff = dayDiff(todayYmd, ymd);
    const when = diff === 0 ? '오늘' : diff === 1 ? '내일' : diff != null && diff > 1 ? `D-${diff}` : '';
    const text = `${formatQuickMonthDay(ymd)}${when ? ` · ${when}` : ''}`;
    return { text, tone: diff != null && diff <= 2 ? 'rose' : 'slate' };
  }
  return { text: '날짜 미정', tone: 'slate' };
}

export function formatFetchedAt(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dt);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('month')}/${pick('day')} ${pick('hour')}:${pick('minute')}`;
}
