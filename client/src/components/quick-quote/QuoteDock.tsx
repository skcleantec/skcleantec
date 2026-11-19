import type { ReactNode } from 'react';

export type QuoteDockTab = 'quote' | 'phrases' | 'ai' | 'address';

const ICON = 'h-[18px] w-[18px]';
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONS: Record<QuoteDockTab, ReactNode> = {
  quote: (
    <svg viewBox="0 0 24 24" className={ICON} {...stroke} aria-hidden>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  phrases: (
    <svg viewBox="0 0 24 24" className={ICON} {...stroke} aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" className={ICON} {...stroke} aria-hidden>
      <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
    </svg>
  ),
  address: (
    <svg viewBox="0 0 24 24" className={ICON} {...stroke} aria-hidden>
      <path d="M3 10l9-7 9 7v10H3z" />
      <path d="M9 20v-6h6v6" />
    </svg>
  ),
};

const TABS: { value: QuoteDockTab; label: string }[] = [
  { value: 'quote', label: '견적' },
  { value: 'phrases', label: '내 문구' },
  { value: 'ai', label: 'AI 견적' },
  { value: 'address', label: '평수' },
];

/** 아래 메뉴 바 높이(여백 포함) — 하단 버튼을 그 위에 띄울 때 쓴다 */
export const QUOTE_DOCK_SPACE = 'calc(4.5rem + env(safe-area-inset-bottom))';

/** 청소비서 앱 하단 메뉴와 같은 어두운 유리 알약 */
export function QuoteDock({ active, onChange }: { active: QuoteDockTab; onChange: (next: QuoteDockTab) => void }) {
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] px-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      aria-label="모바일 CRM 메뉴"
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/10 bg-[#16181d]/90 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        {TABS.map((tab) => {
          const on = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onChange(tab.value)}
              className={`flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                on
                  ? 'bg-white/20 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'font-medium text-white/45 hover:text-white/75'
              }`}
            >
              {ICONS[tab.value]}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
