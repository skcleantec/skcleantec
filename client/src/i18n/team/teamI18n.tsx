import type { ReactNode } from 'react';
import { teamMessages, type TeamMessageId } from './teamMessages';

const INQUIRY_STATUS_CODES = [
  'PENDING',
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'CS_PROCESSING',
  'CANCEL_CONFIRMED',
] as const;

export type TeamInquiryStatusCode = (typeof INQUIRY_STATUS_CODES)[number];

export function fillTeamTemplate(str: string, vars: Record<string, string>): string {
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

export function teamT(id: TeamMessageId, vars?: Record<string, string>): { ko: string; th: string } {
  const row = teamMessages[id];
  if (!vars) return { ko: row.ko, th: row.th };
  return { ko: fillTeamTemplate(row.ko, vars), th: fillTeamTemplate(row.th, vars) };
}

/** 한 줄(한국어) + 그 아래 태국어 — 팀장 화면 병기 표준 */
export function TeamBiLine({
  id,
  vars,
  className = '',
  koClassName = '',
  thClassName = 'text-fluid-2xs text-gray-600 leading-snug',
}: {
  id: TeamMessageId;
  vars?: Record<string, string>;
  className?: string;
  koClassName?: string;
  thClassName?: string;
}): ReactNode {
  const { ko, th } = teamT(id, vars);
  return (
    <span className={`block ${className}`.trim()}>
      <span className={`block ${koClassName}`.trim()}>{ko}</span>
      <span className={`block ${thClassName}`.trim()}>{th}</span>
    </span>
  );
}

/** 인라인 나란히(내비·짧은 라벨) */
export function TeamBiInline({
  id,
  vars,
  className = '',
}: {
  id: TeamMessageId;
  vars?: Record<string, string>;
  className?: string;
}): ReactNode {
  const { ko, th } = teamT(id, vars);
  return (
    <span className={className}>
      <span className="block">{ko}</span>
      <span className="block text-[0.65rem] text-gray-500 leading-tight">{th}</span>
    </span>
  );
}

/** 한 줄 문자열 병기 (시간 미정 등 표·카드 한 칸용) */
export function teamBiPlain(id: TeamMessageId, vars?: Record<string, string>): string {
  const { ko, th } = teamT(id, vars);
  return `${ko} · ${th}`;
}

export function teamInquiryStatus(code: string): { ko: string; th: string } {
  const key = `team.inquiry.status.${code}` as TeamMessageId;
  if (key in teamMessages) return teamT(key);
  return { ko: code, th: code };
}

/** `<option>`·좁은 표기용 — 한국어만 */
export function teamInquiryStatusKoRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of INQUIRY_STATUS_CODES) {
    out[code] = teamInquiryStatus(code).ko;
  }
  return out;
}

export const TEAM_WEEKDAY_HEADERS: { ko: string; th: string }[] = [
  teamT('team.weekday.sun'),
  teamT('team.weekday.mon'),
  teamT('team.weekday.tue'),
  teamT('team.weekday.wed'),
  teamT('team.weekday.thu'),
  teamT('team.weekday.fri'),
  teamT('team.weekday.sat'),
];

/** 목록·대시보드 등 평수 표기 병기 */
export function formatTeamAreaPyeongBi(pyeong: number | null | undefined): string {
  const u = teamT('team.dashboard.areaUnit');
  if (pyeong == null) return `${teamT('team.common.emDash').ko}${u.ko} · ${teamT('team.common.emDash').th}${u.th}`;
  const v = String(pyeong);
  return `${v}${u.ko} · ${v}${u.th}`;
}
