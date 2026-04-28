import type { OrderTimeSlot } from './orderFormSchedule';

/** 오후 시간대 — 구체적 시각은 이 값 한 가지만 허용 (DB/API 저장 문자열과 동일) */
export const ORDER_FORM_AFTERNOON_TIME_DETAIL_VALUE = '12시~2시 사이 (협의)';

const M = (h: number, min: number) => h * 60 + min;

function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 시작~종료(포함), 30분 간격 HH:mm 목록 */
function halfHourRange(startMin: number, endMin: number): string[] {
  const out: string[] = [];
  for (let t = startMin; t <= endMin; t += 30) {
    out.push(hhmm(t));
  }
  return out;
}

/** 오전·사이청소는 30분 단위 HH:mm, 오후는 고정 문구 한 가지만 */
export function allowedPreferredTimeDetailValues(slot: OrderTimeSlot): Set<string> {
  if (slot === '오전') return new Set(halfHourRange(M(8, 0), M(9, 0)));
  if (slot === '오후') return new Set([ORDER_FORM_AFTERNOON_TIME_DETAIL_VALUE]);
  return new Set(halfHourRange(M(10, 0), M(13, 0)));
}

export function formatOrderFormTimeDetailLabel(hhmmStr: string): string {
  const parts = hhmmStr.split(':');
  if (parts.length !== 2) return hhmmStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmmStr;
  const mm = String(m).padStart(2, '0');
  if (h < 12) return `오전 ${h}:${mm}`;
  if (h === 12) return `오후 12:${mm}`;
  return `오후 ${h - 12}:${mm}`;
}

export function getPreferredTimeDetailSelectOptions(slot: OrderTimeSlot): { value: string; label: string }[] {
  if (slot === '오후') {
    const v = ORDER_FORM_AFTERNOON_TIME_DETAIL_VALUE;
    return [{ value: v, label: v }];
  }
  return [...allowedPreferredTimeDetailValues(slot)]
    .sort()
    .map((value) => ({
      value,
      label: formatOrderFormTimeDetailLabel(value),
    }));
}

/** 자유 입력·과거 데이터에서 HH:mm 추출 */
export function parsePreferredTimeDetailToHHMM(raw: string): string | null {
  const m = raw.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** 과거 오후 저장값(HH:mm) 여부 — 12:00~14:00 구간 */
function isLegacyAfternoonHHMM(hhmm: string): boolean {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return false;
  const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  return mins >= M(12, 0) && mins <= M(14, 0);
}

/** 선택된 시간대에 허용되는 값만 유지, 아니면 빈 문자열 */
export function coercePreferredTimeDetailForSlot(raw: string, slot: OrderTimeSlot): string {
  const allowed = allowedPreferredTimeDetailValues(slot);
  const t = raw.trim();
  if (allowed.has(t)) return t;
  if (slot === '오후') {
    const hh = parsePreferredTimeDetailToHHMM(raw);
    if (hh && isLegacyAfternoonHHMM(hh)) return ORDER_FORM_AFTERNOON_TIME_DETAIL_VALUE;
    return '';
  }
  const hh = parsePreferredTimeDetailToHHMM(raw);
  if (hh && allowed.has(hh)) return hh;
  return '';
}

/** 섹션 안내 문구 */
export function preferredTimeDetailRangeHint(slot: OrderTimeSlot): string {
  if (slot === '오전') return '오전 8시~9시 사이, 30분 단위로 선택할 수 있습니다.';
  if (slot === '오후') return '오후는 12시~2시 사이 일정만 선택할 수 있으며, 세부 시각은 협의입니다.';
  return '오전 10시~오후 1시 사이, 30분 단위로 선택할 수 있습니다.';
}
