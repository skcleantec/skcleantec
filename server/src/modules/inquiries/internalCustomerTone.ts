import type { InternalCustomerTone } from '@prisma/client';

const TONE_VALUES: InternalCustomerTone[] = ['GOOD', 'NORMAL', 'BAD', 'SEVERE', 'ELDERLY'];

/** 1차: 마케터·관리자만. 팀장·외부 확장 시 이 함수만 조정 */
export function canViewInternalCustomerTone(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function canEditInternalCustomerTone(role: string | undefined): boolean {
  return canViewInternalCustomerTone(role);
}

export function parseInternalCustomerToneInput(raw: unknown): InternalCustomerTone | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toUpperCase();
  if (TONE_VALUES.includes(s as InternalCustomerTone)) {
    return s as InternalCustomerTone;
  }
  return null;
}

export function internalCustomerToneEmoji(tone: InternalCustomerTone): string {
  switch (tone) {
    case 'GOOD':
      return '👼';
    case 'BAD':
      return '😈';
    case 'SEVERE':
      return '💀';
    case 'ELDERLY':
      return '🧓';
    default:
      return '';
  }
}

/** 변경 이력·관리 화면 — 이모티콘만 (문구 노출 최소화) */
export function internalCustomerToneDisplay(tone: InternalCustomerTone): string {
  return internalCustomerToneEmoji(tone);
}

/** API 응답 — 권한 없으면 필드 제거 */
export function attachInternalCustomerToneForRole<T extends { internalCustomerTone?: InternalCustomerTone }>(
  row: T,
  role: string | undefined,
): Omit<T, 'internalCustomerTone'> & { internalCustomerTone?: InternalCustomerTone } {
  if (!canViewInternalCustomerTone(role)) {
    const { internalCustomerTone: _omit, ...rest } = row;
    return rest;
  }
  return row;
}

export function mapInquiriesInternalToneForRole<T extends { internalCustomerTone?: InternalCustomerTone }>(
  items: T[],
  role: string | undefined,
): Array<Omit<T, 'internalCustomerTone'> & { internalCustomerTone?: InternalCustomerTone }> {
  return items.map((row) => attachInternalCustomerToneForRole(row, role));
}

function parseChangeLogLinesArray(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  return lines.filter((x): x is string => typeof x === 'string');
}

/** 변경 이력에 기록되는 마케터·관리자 전용 라벨 — 팀장·타업체·기타 역할 노출 금지 */
export function isMarketerOnlyChangeLogLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith('내부 표시:') || t.startsWith('내부 표시 :');
}

export function filterMarketerOnlyChangeLogLines(lines: unknown): string[] {
  return parseChangeLogLinesArray(lines).filter((line) => !isMarketerOnlyChangeLogLine(line));
}

type ChangeLogLinesCarrier = { lines: unknown };

/** 팀장·타업체 등 restricted viewer용 — 마케터 전용 줄 제거, 빈 이력은 제외 */
export function sanitizeChangeLogsForRestrictedViewer<T extends ChangeLogLinesCarrier>(
  logs: T[] | undefined | null,
): T[] {
  if (!logs?.length) return [];
  const out: T[] = [];
  for (const log of logs) {
    const lines = filterMarketerOnlyChangeLogLines(log.lines);
    if (lines.length > 0) out.push({ ...log, lines });
  }
  return out;
}

/** 팀·타업체 API — internalCustomerTone 필드·변경 이력 마케터 전용 줄 제거 */
export function sanitizeInquiryForRestrictedViewer<T extends Record<string, unknown>>(row: T): T {
  const carrier = row as T & {
    internalCustomerTone?: InternalCustomerTone;
    changeLogs?: ChangeLogLinesCarrier[];
  };
  const withoutTone = attachInternalCustomerToneForRole(carrier, 'TEAM_LEADER');
  if (!withoutTone.changeLogs?.length) {
    return withoutTone as T;
  }
  return {
    ...withoutTone,
    changeLogs: sanitizeChangeLogsForRestrictedViewer(withoutTone.changeLogs),
  } as T;
}

export function sanitizeInquiriesForRestrictedViewer<T extends Record<string, unknown>>(items: T[]): T[] {
  return items.map(sanitizeInquiryForRestrictedViewer);
}
