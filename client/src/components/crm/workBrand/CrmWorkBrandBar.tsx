import { operatingCompanyBadgeColorClasses } from '../../../utils/operatingCompanyBadgeColors';
import type { MyOperatingCompanyItem } from '../../../api/operatingCompanies';
import { confirmDialog } from '../../ui/Toast';

type CrmWorkBrandBarProps = {
  items: MyOperatingCompanyItem[];
  activeSlug: string | null;
  onSwitch: (slug: string) => void;
  switching?: boolean;
  /** strip: 전역 상단 띠 · inline: 접수·고객 패널 헤더 내 */
  variant?: 'strip' | 'inline';
};

export function CrmWorkBrandBar({
  items,
  activeSlug,
  onSwitch,
  switching = false,
  variant = 'inline',
}: CrmWorkBrandBarProps) {
  if (items.length <= 1) return null;

  const chips = items.map((item) => {
    const selected = item.slug === activeSlug;
    const colorCls = operatingCompanyBadgeColorClasses({
      id: item.operatingCompanyId,
      slug: item.slug,
      name: item.displayName,
      badgeColorKey: item.config?.branding?.badgeColorKey,
      inactive: !item.isActive,
    });
    const strip = variant === 'strip';
    return (
      <button
        key={item.operatingCompanyId}
        type="button"
        disabled={switching || selected}
        aria-pressed={selected}
        onClick={() => {
          if (selected) return;
          void (async () => {
            const ok = await confirmDialog({
              title: `작업 브랜드를 「${item.displayName}」로 바꿉니다.`,
              body: '고객 조회·저장·숨고 연동이 해당 브랜드 기준으로 바뀝니다.',
              confirmLabel: '바꾸기',
            });
            if (ok) onSwitch(item.slug);
          })();
        }}
        className={
          selected
            ? `inline-flex h-7 max-w-[11rem] items-center gap-1 whitespace-nowrap rounded-lg pl-1.5 pr-2 text-fluid-2xs font-bold shadow-sm ring-2 ring-offset-1 disabled:cursor-default ${
                strip ? 'ring-white/90 ring-offset-slate-900' : 'ring-slate-900/80 ring-offset-white'
              } ${colorCls}`
            : `inline-flex h-7 max-w-[9rem] items-center whitespace-nowrap rounded-lg border border-dashed px-2 text-fluid-2xs font-medium transition disabled:opacity-50 ${
                strip
                  ? 'border-white/30 bg-transparent text-slate-400 hover:border-white/60 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-700'
              }`
        }
        title={
          selected
            ? `지금 「${item.displayName}」 브랜드로 작업 중`
            : `누르면 「${item.displayName}」 브랜드로 바꿉니다`
        }
      >
        {selected ? (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
            <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        <span className="truncate">{item.displayName}</span>
        {selected ? <span className="shrink-0 text-[10px] font-semibold opacity-80">사용 중</span> : null}
        {!selected && item.isPrimary ? <span className="ml-0.5 shrink-0 opacity-70">·기본</span> : null}
      </button>
    );
  });

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="작업 브랜드">
        <span className="mr-0.5 whitespace-nowrap text-fluid-2xs font-semibold text-slate-600">작업 브랜드</span>
        {chips}
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/10 bg-slate-950/40 px-3 py-2 sm:px-4"
      role="group"
      aria-label="작업 브랜드"
    >
      <span className="mr-1 text-fluid-2xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
        작업 브랜드
      </span>
      {chips}
    </div>
  );
}
