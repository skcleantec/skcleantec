/** 브라우저 로컬 날짜 기준 YYYY-MM-DD */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type DateRangePresetId = 'custom' | 'today' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

export const DATE_RANGE_PRESET_LABELS: { id: DateRangePresetId; label: string }[] = [
  { id: 'custom', label: '직접 선택' },
  { id: 'today', label: '오늘' },
  { id: 'thisMonth', label: '이번 달' },
  { id: 'lastMonth', label: '지난 달' },
  { id: 'thisYear', label: '올해' },
  { id: 'lastYear', label: '지난해' },
];

/**
 * 기간 조회용 프리셋 → 시작일·종료일 (로컬 달력 기준).
 * 보고서·집계 화면에서 드롭다운 선택 시 `from`/`to` state에 넣고 API를 호출한다.
 */
export function computeDateRangeFromPreset(preset: DateRangePresetId): { from: string; to: string } | null {
  if (preset === 'custom') return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case 'today': {
      const t = new Date(y, m, d);
      const s = ymd(t);
      return { from: s, to: s };
    }
    case 'thisMonth': {
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0);
      return { from: ymd(from), to: ymd(to) };
    }
    case 'lastMonth': {
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0);
      return { from: ymd(from), to: ymd(to) };
    }
    case 'thisYear': {
      const from = new Date(y, 0, 1);
      const to = new Date(y, 11, 31);
      return { from: ymd(from), to: ymd(to) };
    }
    case 'lastYear': {
      const from = new Date(y - 1, 0, 1);
      const to = new Date(y - 1, 11, 31);
      return { from: ymd(from), to: ymd(to) };
    }
    default:
      return null;
  }
}
