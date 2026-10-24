import { LineMdIcon } from './LineMdIcon';

/** 플랜에 없는 메뉴의 작은 배지. 예: Standard부터 */
export function PlanLockBadge({ label, tone }: { label: string; tone: 'dark' | 'light' }) {
  const toneClass =
    tone === 'dark' ? 'bg-white/10 text-amber-200' : 'bg-amber-50 text-amber-800';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0 text-fluid-2xs leading-none ${toneClass}`}
    >
      <LineMdIcon name="lock" className="size-3" />
      {label}
    </span>
  );
}
