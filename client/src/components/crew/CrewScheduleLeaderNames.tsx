import type { ReactNode } from 'react';
import type { CrewFieldLeader } from '../../api/crew';

function leaderChipContent(l: CrewFieldLeader, align: 'center' | 'start'): ReactNode {
  const jc = align === 'start' ? 'justify-start' : 'justify-center';
  if (l.role === 'EXTERNAL_PARTNER') {
    return <>{l.externalCompanyName ? `[타] ${l.externalCompanyName}` : l.name}</>;
  }
  const en = (l.nameEn ?? '').trim();
  return (
    <span className={`inline-flex max-w-full min-w-0 flex-nowrap items-baseline gap-x-1 ${jc}`}>
      <span className="text-gray-900">{l.name}</span>
      {en ? (
        <span className="text-[0.65rem] leading-tight text-gray-600 whitespace-nowrap">{en}</span>
      ) : null}
    </span>
  );
}

/** 크루 현장 일정 표 — 배정 팀장 열 (한글 이름 + 로마자 붙임 · 여러 명은 ·) */
export function CrewScheduleLeaderNames({
  leaders,
  align = 'center',
}: {
  leaders: CrewFieldLeader[];
  align?: 'center' | 'start';
}) {
  if (!leaders.length) return <>—</>;
  const outer = align === 'start' ? 'justify-start' : 'justify-center';
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5 ${outer}`}>
      {leaders.map((l, i) => (
        <span key={l.id} className="inline-flex items-baseline gap-x-1">
          {i > 0 ? <span className="text-gray-400 shrink-0">·</span> : null}
          {leaderChipContent(l, align)}
        </span>
      ))}
    </span>
  );
}

export function crewScheduleLeadersPlain(leaders: CrewFieldLeader[]): string {
  if (!leaders.length) return '—';
  return leaders
    .map((l) => {
      if (l.role === 'EXTERNAL_PARTNER') {
        return l.externalCompanyName ? `[타] ${l.externalCompanyName}` : l.name;
      }
      const en = (l.nameEn ?? '').trim();
      return en ? `${l.name} ${en}` : l.name;
    })
    .join('·');
}
