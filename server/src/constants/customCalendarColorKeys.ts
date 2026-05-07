/**
 * 사용자 맞춤 캘린더 `colorKey` 허용 목록.
 * 클라이언트 `client/src/constants/customCalendarColors.ts` 의 키와 동일하게 유지할 것.
 */
export const CUSTOM_CALENDAR_COLOR_KEYS = [
  'teal',
  'amber',
  'rose',
  'violet',
  'sky',
  'emerald',
  'slate',
  'cyan',
  'lime',
  'orange',
  'indigo',
  'pink',
  'red',
  'blue',
  'purple',
  'fuchsia',
  'yellow',
  'stone',
  'zinc',
  'neutral',
  'gray',
  'green',
] as const;

export function sanitizeCustomCalendarColorKey(value: unknown): string {
  if (typeof value !== 'string') return 'teal';
  const k = value.trim();
  return (CUSTOM_CALENDAR_COLOR_KEYS as readonly string[]).includes(k) ? k : 'teal';
}
