/** DB/API에 저장되는 시간대 값 (오전·오후·사이청소) */
export type OrderTimeSlot = '오전' | '오후' | '사이청소';

export const ORDER_TIME_SLOT_OPTIONS: { value: OrderTimeSlot; label: string }[] = [
  { value: '오전', label: '오전 (8시~9시 시작)' },
  { value: '오후', label: '오후 (12시~14시 시작)' },
  { value: '사이청소', label: '사이청소 (이사 전·입주 사이 등)' },
];

export function labelForTimeSlot(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const o = ORDER_TIME_SLOT_OPTIONS.find((x) => x.value === value);
  return o?.label ?? value;
}
