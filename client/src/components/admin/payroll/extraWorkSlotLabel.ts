/** 접수 시간대를 표·상세에서 오전/오후로 짧게 보여 준다. */
export function extraWorkSlotLabel(value: string | null | undefined) {
  const text = (value ?? '').trim();
  if (!text) return '';
  if (text.includes('오전')) return '오전';
  if (text.includes('오후')) return '오후';
  if (text.includes('사이')) return '사이';
  if (text.includes('조율')) return '조율';
  if (text.includes('종일')) return '종일';
  return text;
}
