import type { ReactNode } from 'react';
import { crewMessages, type CrewMessageId } from './crewMessages';

export function fillCrewTemplate(str: string, vars: Record<string, string>): string {
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

export function crewT(id: CrewMessageId, vars?: Record<string, string>): { ko: string; th: string } {
  const row = crewMessages[id];
  if (!vars) return { ko: row.ko, th: row.th };
  return { ko: fillCrewTemplate(row.ko, vars), th: fillCrewTemplate(row.th, vars) };
}

/** 한 줄(한국어) + 그 아래 태국어 — 크루 화면 병기 표준 */
export function CrewBiLine({
  id,
  vars,
  className = '',
  koClassName = '',
  thClassName = 'text-fluid-2xs text-gray-600 leading-snug',
}: {
  id: CrewMessageId;
  vars?: Record<string, string>;
  className?: string;
  koClassName?: string;
  thClassName?: string;
}): ReactNode {
  const { ko, th } = crewT(id, vars);
  return (
    <span className={`block ${className}`.trim()}>
      <span className={`block ${koClassName}`.trim()}>{ko}</span>
      <span className={`block ${thClassName}`.trim()}>{th}</span>
    </span>
  );
}

/** 인라인 나란히(짧은 내비 등) — 필요 시 */
export function CrewBiInline({
  id,
  vars,
  className = '',
}: {
  id: CrewMessageId;
  vars?: Record<string, string>;
  className?: string;
}): ReactNode {
  const { ko, th } = crewT(id, vars);
  return (
    <span className={className}>
      <span className="block">{ko}</span>
      <span className="block text-[0.65rem] text-gray-500 leading-tight">{th}</span>
    </span>
  );
}
