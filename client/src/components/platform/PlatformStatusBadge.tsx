type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'lock';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-900 ring-amber-200',
  bad: 'bg-red-50 text-red-800 ring-red-200',
  muted: 'bg-gray-100 text-gray-600 ring-gray-200',
  lock: 'bg-gray-100 text-gray-500 ring-gray-200',
};

export function PlatformStatusBadge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-fluid-2xs font-medium ring-1 ${TONE_CLASS[tone]}`}>
      {tone === 'lock' ? '🔒 ' : ''}
      {children}
    </span>
  );
}

export function waitingTone(iso: string): 'bad' | 'warn' | 'muted' {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms >= 24 * 60 * 60 * 1000) return 'bad';
  if (ms >= 60 * 60 * 1000) return 'warn';
  return 'muted';
}

export function waitingLabel(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min}분`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}
