/** 한국 고정 공휴일 (양력) */
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],   // 신정
  [3, 1],   // 3·1절
  [5, 5],   // 어린이날
  [6, 6],   // 현충일
  [8, 15],  // 광복절
  [10, 3],  // 개천절
  [10, 9],  // 한글날
  [12, 25], // 크리스마스
];

export function isPublicHoliday(_year: number, month: number, day: number): boolean {
  return FIXED_HOLIDAYS.some(([m, d]) => m === month && d === day);
}
