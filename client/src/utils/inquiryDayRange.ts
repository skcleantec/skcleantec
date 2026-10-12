/** 서비스접수 날짜 필터 — 시작~끝 포함, 최대 366일. 서버 clampKstYmdRange 와 같다. */

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const INQUIRY_DAY_RANGE_MAX_DAYS = 366;

export function isInquiryYmd(value: string) {
  return YMD.test(value);
}

function addDaysYmd(ymd: string, deltaDays: number) {
  const t = new Date(`${ymd}T12:00:00+09:00`).getTime() + deltaDays * 86400000;
  return new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function normalizeInquiryDayRange(fromRaw: string, toRaw: string, fallback: string) {
  const fallbackYmd = isInquiryYmd(fallback) ? fallback : new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  let from = isInquiryYmd(fromRaw) ? fromRaw : fallbackYmd;
  let to = isInquiryYmd(toRaw) ? toRaw : from;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const maxTo = addDaysYmd(from, INQUIRY_DAY_RANGE_MAX_DAYS - 1);
  const clamped = to > maxTo;
  if (clamped) to = maxTo;
  return { from, to, clamped };
}

export function formatInquiryDaySpan(from: string, to: string) {
  const short = (ymd: string) => {
    const [, month, day] = ymd.split('-');
    return `${Number(month)}/${Number(day)}`;
  };
  if (from === to) return short(from);
  return `${short(from)}~${short(to)}`;
}
