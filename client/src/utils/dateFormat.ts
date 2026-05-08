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

/** 오늘 날짜 YYYY-MM-DD (KST) — 팀장 배정·직원 재직일 등과 동일 기준 */
export function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** KST 달력 `YYYY-MM-DD`에 일 수를 더함(음수면 과거). 한국 정오 기준으로 이동해 일 경계 오차를 줄임. */
export function addDaysToKstYmd(ymd: string, deltaDays: number): string {
  const p = ymd.split('-').map(Number);
  const y = p[0];
  const m = p[1];
  const d = p[2];
  if (!y || !m || !d) return ymd;
  const isoNoonKst = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+09:00`;
  const t = new Date(isoNoonKst).getTime() + deltaDays * 86400000;
  return new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** JS Date#getDay() → 한 글자 요일 (일~토) */
export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** JS Date#getDay() → 영어 약어 (일~토, Sun~Sat) — 크루 등 다국어 사용자용 */
export const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** 년·월·일(로컬) → 요일 한 글자 */
export function weekdayKoFromYmd(year: number, month1to12: number, day: number): string {
  return WEEKDAY_KO[new Date(year, month1to12 - 1, day).getDay()];
}

/**
 * 짧은 날짜 + 요일 (예: 25.03.30 화)
 * - 순수 `YYYY-MM-DD` 문자열만 달력 그대로 사용(예약일 등).
 * - ISO 시각 포함 문자열·Date는 **한국(Asia/Seoul) 달력**으로 변환 후 표시.
 *   (`slice(0,10)`만 쓰면 UTC 날짜가 되어 KST 자정~오전 접수가 전날로 보임)
 */
export function formatDateCompactWithWeekday(input: string | Date | null | undefined): string {
  if (input == null || input === '') return '-';
  let y: number;
  let m: number;
  let day: number;
  if (typeof input === 'string') {
    const s = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const p = s.split('-').map(Number);
      y = p[0];
      m = p[1];
      day = p[2];
    } else {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return '-';
      const kst = d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
      const p = kst.split('-').map(Number);
      y = p[0];
      m = p[1];
      day = p[2];
    }
  } else {
    if (Number.isNaN(input.getTime())) return '-';
    const kst = input.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const p = kst.split('-').map(Number);
    y = p[0];
    m = p[1];
    day = p[2];
  }
  const wd = WEEKDAY_KO[new Date(y, m - 1, day).getDay()];
  const yy = String(y).slice(-2);
  return `${yy}.${String(m).padStart(2, '0')}.${String(day).padStart(2, '0')} ${wd}`;
}

/** C/S 목록·모바일용 짧은 날짜+시간 (예: 3/30 14:30) — 날짜·시각 모두 KST */
export function formatDateTimeTinyKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const ymd = d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const [, mm, dd] = ymd.split('-');
  const hm = d.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${Number(mm)}/${Number(dd)} ${hm}`;
}

/** 날짜+시간(예: 25.03.30 화 14:30) — KST */
export function formatDateTimeCompactWithWeekday(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const datePart = formatDateCompactWithWeekday(d);
  const hm = d.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} ${hm}`;
}
