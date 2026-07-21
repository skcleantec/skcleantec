import { operatingCompanyBadgeColorClasses } from '../../../utils/operatingCompanyBadgeColors';
import type { MyOperatingCompanyItem } from '../../../api/operatingCompanies';

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
    return (
      <button
        key={item.operatingCompanyId}
        type="button"
        disabled={switching || selected}
        onClick={() => {
          if (selected) return;
          const ok = window.confirm(
            `작업 브랜드를 「${item.displayName}」로 바꿉니다.\n고객 조회·저장·숨고 연동이 해당 브랜드 기준으로 바뀁니다.`,
          );
          if (ok) onSwitch(item.slug);
        }}
        className={
          variant === 'inline'
            ? `inline-flex max-w-[8.5rem] items-center rounded-md px-2 py-0.5 text-[10px] font-semibold truncate transition ${
                selected
                  ? `ring-1 ring-emerald-400/80 ring-offset-1 ring-offset-white ${colorCls}`
                  : `opacity-80 hover:opacity-100 ${colorCls}`
              }`
            : `inline-flex max-w-[10rem] items-center rounded-lg px-2.5 py-1 text-fluid-2xs font-semibold truncate transition ${
                selected
                  ? `ring-2 ring-white/80 ring-offset-1 ring-offset-slate-900 ${colorCls}`
                  : `opacity-75 hover:opacity-100 ${colorCls}`
              }`
        }
        title={item.slug ? `${item.displayName} (${item.slug})` : item.displayName}
      >
        {item.displayName}
        {item.isPrimary ? <span className="ml-0.5 opacity-70">·기본</span> : null}
      </button>
    );
  });

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="작업 브랜드">
        <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">브랜드</span>
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
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
        작업 브랜드
      </span>
      {chips}
    </div>
  );
}
