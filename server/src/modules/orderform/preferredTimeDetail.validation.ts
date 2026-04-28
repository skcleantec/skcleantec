/** 고객 발주서 `preferredTimeDetail` — 시간대별 허용 시각 (클라이언트 `orderFormPreferredTimeDetail.ts` 와 동일 규칙) */

/** 오후 구체적 시각 단일 허용값 — ORDER_FORM_AFTERNOON_TIME_DETAIL_VALUE 와 문자열 동일 */
const AFTERNOON_NEGOTIABLE_DETAIL = '12시~2시 사이 (협의)';

const M = (h: number, min: number) => h * 60 + min;

function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function halfHourRange(startMin: number, endMin: number): string[] {
  const out: string[] = [];
  for (let t = startMin; t <= endMin; t += 30) {
    out.push(hhmm(t));
  }
  return out;
}

function allowedValuesForSlot(slot: string): Set<string> | null {
  if (slot === '오전') return new Set(halfHourRange(M(8, 0), M(9, 0)));
  if (slot === '오후') return new Set([AFTERNOON_NEGOTIABLE_DETAIL]);
  if (slot === '사이청소') return new Set(halfHourRange(M(10, 0), M(13, 0)));
  return null;
}

/** 고객이 수정 가능한 경우에만 검증 — 값이 있으면 허용 목록에 있어야 함 */
export function isAllowedPreferredTimeDetail(preferredTime: string, detail: string): boolean {
  const allowed = allowedValuesForSlot(preferredTime.trim());
  if (!allowed) return false;
  return allowed.has(detail.trim());
}
