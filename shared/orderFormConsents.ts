/** 고객 발주서 — 모듈별 동의 이력 (제출 스냅샷 JSON) */

export type OrderFormConsentServiceDate = {
  agreedAt: string;
  preferredDate: string;
  ackBody?: string | null;
};

export type OrderFormConsentTimeSlot = {
  agreedAt: string;
  preferredTime: string;
  preferredTimeDetail?: string | null;
  ackBody?: string | null;
};

export type OrderFormConsentGuideTerms = {
  agreedAt: string;
};

export type OrderFormSubmissionConsents = {
  serviceDate?: OrderFormConsentServiceDate | null;
  timeSlot?: OrderFormConsentTimeSlot | null;
  guideTerms?: OrderFormConsentGuideTerms | null;
};

export type OrderFormConsentKind = 'serviceDate' | 'timeSlot' | 'guideTerms';

/** KST — 「2026년 8월 10일 오후 3:42」 */
export function formatOrderFormConsentKst(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    const dayPeriod = pick('dayPeriod');
    const hour = pick('hour');
    const minute = pick('minute');
    const period = dayPeriod ? `${dayPeriod} ` : '';
    return `${year}년 ${month} ${day}일 ${period}${hour}시 ${minute}분`.replace(/\s+/g, ' ').trim();
  } catch {
    return iso;
  }
}

/** 고객 동의 배너 — 모듈 구분 없이 동일 문구 */
export function orderFormConsentStampLabel(_kind: OrderFormConsentKind, agreedAt: string): string {
  const when = formatOrderFormConsentKst(agreedAt);
  return `${when}에 고객님께서는 모든 내용을 이해하셨고, 직접 동의하셨습니다.`;
}

export function isOrderFormSubmissionConsents(x: unknown): x is OrderFormSubmissionConsents {
  if (typeof x !== 'object' || x === null) return false;
  return true;
}
