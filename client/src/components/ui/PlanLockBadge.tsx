import { LineMdIcon } from './LineMdIcon';

/** 메뉴용 잠금 표시. 글자 대신 자물쇠만 둔다. 플랜 이름은 눌러서 연 안내와 툴팁에 있다. */
export function PlanLockBadge({ label, tone }: { label: string; tone: 'dark' | 'light' }) {
  const toneClass = tone === 'dark' ? 'text-amber-200' : 'text-amber-700';
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center ${toneClass}`}
      title={label}
      aria-label={label}
    >
      <LineMdIcon name="lock" className="size-3.5" />
    </span>
  );
}
