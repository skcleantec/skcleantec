/** 빠른등록 — 이름·날짜 라벨/형식 예시 (규칙 파서·AI 프롬프트 공유) */

export const QUICK_PASTE_NAME_LABELS = [
  '성함',
  '고객명',
  '이름',
  '예약자',
  '의뢰인',
  '고객',
  '신청자',
  '예약고객',
] as const;

export const QUICK_PASTE_DATE_LABELS = [
  '희망일',
  '청소 날짜',
  '청소날짜',
  '청소일',
  '이사 날짜',
  '입주 날짜',
  '일정',
  '날짜',
  '예약일',
  '예약 날짜',
  '시공일',
  '작업일',
] as const;

/** AI few-shot / system 안내용 짧은 예시 */
export const QUICK_PASTE_DATE_AI_EXAMPLES = [
  '날짜 : 2026.03.28 오전 → preferredDate=2026-03-28, preferredTime=오전 (never 260406)',
  '260406 (YYMMDD near date label) → preferredDate=2026-04-06',
  '26.04.06 → preferredDate=2026-04-06',
  '3월 28일 → preferredDate=YYYY-03-28 (current year)',
  '희망일: 2026-03-28 → preferredDate=2026-03-28',
].join(' | ');

export const QUICK_PASTE_NAME_AI_EXAMPLES = [
  '예약자: 김민수 → customerName=김민수',
  '성함 : 이영희 → customerName=이영희',
  '의뢰인 박철수 → customerName=박철수',
].join(' | ');

export function nameLabelAlternation(): string {
  return QUICK_PASTE_NAME_LABELS.map(escapeForAlt).join('|');
}

export function dateLabelAlternation(): string {
  return QUICK_PASTE_DATE_LABELS.map(escapeForAlt).join('|');
}

function escapeForAlt(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
}
