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

export function teamT(id: TeamMessageId, vars?: Record<string, string>): string {
  const row = teamMessages[id];
  const ko = row.ko;
  return vars ? fillTeamTemplate(ko, vars) : ko;
}

/** 팀장 화면 라벨 — 한국어 한 줄 */
export function TeamBiLine({
  id,
  vars,
  className = '',
  koClassName = '',
}: {
  id: TeamMessageId;
  vars?: Record<string, string>;
  className?: string;
  koClassName?: string;
}): ReactNode {
  const text = teamT(id, vars);
  return (
    <span className={`block ${className}`.trim()}>
      <span className={`block ${koClassName}`.trim()}>{text}</span>
    </span>
  );
}

export function TeamBiInline({
  id,
  vars,
  className = '',
}: {
  id: TeamMessageId;
  vars?: Record<string, string>;
  className?: string;
}): ReactNode {
  return <span className={className}>{teamT(id, vars)}</span>;
}

export function teamBiPlain(id: TeamMessageId, vars?: Record<string, string>): string {
  return teamT(id, vars);
}

export function teamInquiryStatus(code: string): string {
  const key = `team.inquiry.status.${code}` as TeamMessageId;
  if (key in teamMessages) return teamT(key);
  return code;
}

/** `<option>`·좁은 표기용 — 한국어만 */
export function teamInquiryStatusKoRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of INQUIRY_STATUS_CODES) {
    out[code] = teamInquiryStatus(code);
  }
  return out;
}

export const TEAM_WEEKDAY_HEADERS: string[] = [
  teamT('team.weekday.sun'),
  teamT('team.weekday.mon'),
  teamT('team.weekday.tue'),
  teamT('team.weekday.wed'),
  teamT('team.weekday.thu'),
  teamT('team.weekday.fri'),
  teamT('team.weekday.sat'),
];

/** 목록·대시보드 등 평수 표기 */
export function formatTeamAreaPyeongBi(pyeong: number | null | undefined): string {
  const unit = teamT('team.dashboard.areaUnit');
  const dash = teamT('team.common.emDash');
  if (pyeong == null) return `${dash}${unit}`;
  return `${pyeong}${unit}`;
}
