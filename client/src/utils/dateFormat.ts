/**
 * ISO 예약일 → 날짜 필드용 YYYY-MM-DD (한국 달력 기준). `YmdSelect` 등과 호환.
 * `toISOString().slice(0,10)`은 UTC 날짜라 KST 자정 전후로 하루 밀릴 수 있음.
 */
export function formatPreferredDateInputYmd(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** JS Date#getDay() → 한 글자 요일 (일~토) */
export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 년·월·일(로컬) → 요일 한 글자 */
export function weekdayKoFromYmd(year: number, month1to12: number, day: number): string {
  return WEEKDAY_KO[new Date(year, month1to12 - 1, day).getDay()];
}

/**
 * 짧은 날짜 + 요일 (예: 25.03.30 화)
 * ISO 날짜만 있는 문자열은 YYYY-MM-DD를 달력 기준으로 파싱(UTC 날짜 밀림 방지)
 */
export function formatDateCompactWithWeekday(input: string | Date | null | undefined): string {
  if (input == null || input === '') return '-';
  let y: number;
  let m: number;
  let day: number;
  if (typeof input === 'string') {
    const dateOnly = input.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const p = dateOnly.split('-').map(Number);
      y = p[0];
      m = p[1];
      day = p[2];
    } else {
      const d = new Date(input);
      if (Number.isNaN(d.getTime())) return '-';
      y = d.getFullYear();
      m = d.getMonth() + 1;
      day = d.getDate();
    }
  } else {
    if (Number.isNaN(input.getTime())) return '-';
    y = input.getFullYear();
    m = input.getMonth() + 1;
    day = input.getDate();
  }
  const wd = WEEKDAY_KO[new Date(y, m - 1, day).getDay()];
  const yy = String(y).slice(-2);
  return `${yy}.${String(m).padStart(2, '0')}.${String(day).padStart(2, '0')} ${wd}`;
}

/** C/S 목록·모바일용 짧은 날짜+시간 (예: 3/30 14:30) */
export function formatDateTimeTinyKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${m}/${day} ${hm}`;
}

/** 날짜+시간(예: 25.03.30 화 14:30) */
export function formatDateTimeCompactWithWeekday(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const datePart = formatDateCompactWithWeekday(d);
  const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart} ${hm}`;
}
