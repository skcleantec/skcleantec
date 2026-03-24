/** 발주서·접수에서 동일하게 쓰는 신축/구축/인테리어/거주 옵션 */
export const ORDER_BUILDING_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '신축', label: '신축 (5년 이하)' },
  { value: '구축', label: '구축' },
  { value: '인테리어', label: '인테리어' },
  { value: '거주(짐이있는상태)', label: '거주(짐이있는상태)' },
];

export function labelForBuildingType(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const o = ORDER_BUILDING_TYPE_OPTIONS.find((x) => x.value === value);
  return o?.label ?? value;
}
