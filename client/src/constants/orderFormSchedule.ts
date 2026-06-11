/** DB/API에 저장되는 시간대 값 (오전·오후·사이청소) */
export type OrderTimeSlot = '오전' | '오후' | '사이청소';

export const ORDER_TIME_SLOT_OPTIONS: { value: OrderTimeSlot; label: string }[] = [
  { value: '오전', label: '오전 (8시~9시 시작)' },
  { value: '오후', label: '오후 (12시~14시 시작)' },
  { value: '사이청소', label: '사이청소(상담내용 동일기재)' },
];

/** 사이청소 선택 시 구체적 시각(7번) 필수 */
export function isPreferredTimeDetailRequired(slot: string | null | undefined): boolean {
  return slot === '사이청소';
}

export function labelForTimeSlot(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const o = ORDER_TIME_SLOT_OPTIONS.find((x) => x.value === value);
  return o?.label ?? value;
}

/** 목록용 짧은 표기: 오전 / 오후 / 사이 */
export function shortTimeSlotLabel(value: string | null | undefined): string {
  if (value == null || value === '') return '-';
  if (value === '사이청소') return '사이';
  if (value === '오전' || value === '오후') return value;
  const o = ORDER_TIME_SLOT_OPTIONS.find((x) => x.value === value);
  if (o?.value === '사이청소') return '사이';
  return value;
}
