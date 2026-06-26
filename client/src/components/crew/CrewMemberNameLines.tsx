import { useCrewUiLang } from '../../i18n/crew/crewUiLanguageContext';

/** 크루 화면 공통: 기본 이름 + 외국어 표기를 같은 줄에 붙여 표시(가운데 정렬 블록) */
export function CrewMemberNameLines({
  name,
  nameTh,
  inactive,
  variant = 'default',
  className = '',
}: {
  name: string;
  nameTh?: string | null;
  inactive?: boolean;
  /** 일할 멤버 열 등 톤 맞춤 */
  variant?: 'default' | 'emerald';
  className?: string;
}) {
  const uiLang = useCrewUiLang();
  const th = uiLang !== 'ko' ? (nameTh ?? '').trim() : '';
  const mainCls = inactive
    ? 'text-gray-400 line-through'
    : variant === 'emerald'
      ? 'text-emerald-950'
      : 'text-gray-900';
  const subCls = inactive
    ? 'text-gray-400 line-through'
    : variant === 'emerald'
      ? 'text-emerald-800/95'
      : 'text-gray-600';
  return (
    <span
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-baseline justify-center gap-x-1 ${className}`}
    >
      <span className={`min-w-0 shrink truncate ${mainCls}`}>{name}</span>
      {th ? (
        <span className={`shrink-0 text-[0.65rem] leading-tight whitespace-nowrap ${subCls}`}>{th}</span>
      ) : null}
    </span>
  );
}
