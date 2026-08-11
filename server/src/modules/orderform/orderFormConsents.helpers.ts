import { ORDER_FORM_CONFIG_DEFAULTS } from '../../constants/orderFormConfigDefaults.js';

function orderFormConfigLine(raw: string | null | undefined, fallback: string): string {
  const t = raw != null ? String(raw).trim() : '';
  return t || fallback;
}

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

type RawConsentBody = {
  agreedAt?: unknown;
  preferredDate?: unknown;
  preferredTime?: unknown;
  preferredTimeDetail?: unknown;
  ackBody?: unknown;
};

function parseIsoAgreedAt(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  if (d.getTime() > now + 120_000) return null;
  if (d.getTime() < now - 7 * 24 * 60 * 60 * 1000) return null;
  return d.toISOString();
}

function parseConsentServiceDate(raw: unknown): OrderFormConsentServiceDate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as RawConsentBody;
  const agreedAt = parseIsoAgreedAt(o.agreedAt);
  const preferredDate = typeof o.preferredDate === 'string' ? o.preferredDate.trim() : '';
  if (!agreedAt || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) return null;
  return {
    agreedAt,
    preferredDate,
    ackBody: o.ackBody != null ? String(o.ackBody) : null,
  };
}

function parseConsentTimeSlot(raw: unknown): OrderFormConsentTimeSlot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as RawConsentBody;
  const agreedAt = parseIsoAgreedAt(o.agreedAt);
  const preferredTime = typeof o.preferredTime === 'string' ? o.preferredTime.trim() : '';
  if (!agreedAt || !preferredTime) return null;
  const detail =
    o.preferredTimeDetail != null && String(o.preferredTimeDetail).trim()
      ? String(o.preferredTimeDetail).trim()
      : null;
  return {
    agreedAt,
    preferredTime,
    preferredTimeDetail: detail,
    ackBody: o.ackBody != null ? String(o.ackBody) : null,
  };
}

function parseConsentGuideTerms(raw: unknown): OrderFormConsentGuideTerms | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const agreedAt = parseIsoAgreedAt((raw as RawConsentBody).agreedAt);
  if (!agreedAt) return null;
  return { agreedAt };
}

export function parseOrderFormSubmitConsents(raw: unknown): OrderFormSubmissionConsents | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const serviceDate = parseConsentServiceDate(o.serviceDate);
  const timeSlot = parseConsentTimeSlot(o.timeSlot);
  const guideTerms = parseConsentGuideTerms(o.guideTerms);
  if (!serviceDate && !timeSlot && !guideTerms) return null;
  return { serviceDate, timeSlot, guideTerms };
}

export function resolveOrderFormAckBodies(formConfig: {
  serviceDateAckBody?: string | null;
  timeSlotAckBody?: string | null;
} | null | undefined): { serviceDateAckBody: string; timeSlotAckBody: string } {
  return {
    serviceDateAckBody: orderFormConfigLine(
      formConfig?.serviceDateAckBody,
      ORDER_FORM_CONFIG_DEFAULTS.serviceDateAckBody,
    ),
    timeSlotAckBody: orderFormConfigLine(
      formConfig?.timeSlotAckBody,
      ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckBody,
    ),
  };
}

export function validateOrderFormSubmitConsents(params: {
  consentsRaw: unknown;
  needsServiceDateConsent: boolean;
  needsTimeSlotConsent: boolean;
  useDateStr: string;
  useTimeStr: string;
  useDetailStr: string | null;
  formConfig?: { serviceDateAckBody?: string | null; timeSlotAckBody?: string | null } | null;
}): { ok: true; consents: OrderFormSubmissionConsents } | { ok: false; error: string } {
  const parsed = parseOrderFormSubmitConsents(params.consentsRaw);
  const ackBodies = resolveOrderFormAckBodies(params.formConfig);

  if (!parsed?.guideTerms) {
    return { ok: false, error: '[필수] 예약 안내 및 개인정보 제3자 제공 동의가 필요합니다.' };
  }

  let serviceDate: OrderFormConsentServiceDate | null = null;
  if (params.needsServiceDateConsent) {
    if (!parsed?.serviceDate) {
      return { ok: false, error: '청소날짜·위약금 안내에 동의해 주세요.' };
    }
    if (parsed.serviceDate.preferredDate !== params.useDateStr) {
      return { ok: false, error: '청소날짜 동의 내용이 선택하신 날짜와 일치하지 않습니다. 다시 동의해 주세요.' };
    }
    serviceDate = {
      ...parsed.serviceDate,
      ackBody: ackBodies.serviceDateAckBody,
    };
  }

  let timeSlot: OrderFormConsentTimeSlot | null = null;
  if (params.needsTimeSlotConsent) {
    if (!parsed?.timeSlot) {
      return { ok: false, error: '시간대·오입력 안내에 동의해 주세요.' };
    }
    if (parsed.timeSlot.preferredTime !== params.useTimeStr) {
      return { ok: false, error: '시간대 동의 내용이 선택하신 시간과 일치하지 않습니다. 다시 동의해 주세요.' };
    }
    timeSlot = {
      ...parsed.timeSlot,
      preferredTimeDetail: params.useDetailStr?.trim() || null,
      ackBody: ackBodies.timeSlotAckBody,
    };
  }

  return {
    ok: true,
    consents: {
      serviceDate,
      timeSlot,
      guideTerms: parsed.guideTerms,
    },
  };
}
