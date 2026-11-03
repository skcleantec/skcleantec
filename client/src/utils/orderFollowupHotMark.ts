export const HOT_MARK_REASONS = [
  { id: 'PRICE', label: '가격만 고민' },
  { id: 'DATE', label: '날짜 미정' },
  { id: 'FAMILY', label: '가족과 상의' },
  { id: 'COMPARE', label: '다른 곳과 비교 중' },
  { id: 'CALL_LATER', label: '다시 연락 달라고 함' },
  { id: 'OTHER', label: '기타' },
] as const;

export type HotMarkReasonId = (typeof HOT_MARK_REASONS)[number]['id'];

export function hotReasonLabel(reason: string): string {
  return HOT_MARK_REASONS.find((row) => row.id === reason)?.label ?? reason;
}

function kstYmd(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function addKstDays(ymd: string, days: number): string {
  return kstYmd(new Date(new Date(`${ymd}T12:00:00+09:00`).getTime() + days * 86400000));
}

export function kstDateTimeIso(ymd: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+09:00`).toISOString();
}

export function hotWhenPresets(now = new Date()): { id: string; label: string; at: string }[] {
  const today = kstYmd(now);
  const tomorrow = addKstDays(today, 1);
  const dayAfter = addKstDays(today, 2);
  return [
    { id: 'tonight', label: '오늘 저녁 19시', at: kstDateTimeIso(today, 19, 0) },
    { id: 'tom10', label: '내일 10시', at: kstDateTimeIso(tomorrow, 10, 0) },
    { id: 'tom15', label: '내일 15시', at: kstDateTimeIso(tomorrow, 15, 0) },
    { id: 'day10', label: '모레 10시', at: kstDateTimeIso(dayAfter, 10, 0) },
  ];
}

export function formatHotWhen(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const ymd = kstYmd(date);
  const today = kstYmd(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const clock = `${hour === '24' ? '00' : hour}:${minute}`;
  if (ymd === today) return `오늘 ${clock}`;
  if (ymd === addKstDays(today, 1)) return `내일 ${clock}`;
  if (ymd === addKstDays(today, 2)) return `모레 ${clock}`;
  return `${ymd.slice(5).replace('-', '/')} ${clock}`;
}

export function isHotOverdue(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < now.getTime();
}
