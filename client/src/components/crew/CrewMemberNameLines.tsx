/** 크루 화면 공통: 한글(또는 기본) 이름 + 선택적 태국어 등 보조 한 줄 */
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
  const th = (nameTh ?? '').trim();
  const mainCls = inactive
    ? 'text-gray-400 line-through'
    : variant === 'emerald'
      ? 'text-emerald-950'
      : 'text-gray-900';
  const subCls = inactive
    ? 'text-gray-400'
    : variant === 'emerald'
      ? 'text-emerald-800/95'
      : 'text-gray-600';
  return (
    <span className={`block ${className}`}>
      <span className={mainCls}>{name}</span>
      {th ? <span className={`block text-[0.65rem] mt-0.5 leading-tight ${subCls}`}>{th}</span> : null}
    </span>
  );
}
