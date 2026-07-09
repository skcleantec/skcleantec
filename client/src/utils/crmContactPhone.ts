/** CRM 접수란 — 연락처(010)·안심번호(050) 분리·통화 우선순위 */

export function normalizeCrmPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isCrmMobilePhone(raw: string): boolean {
  const d = normalizeCrmPhoneDigits(raw);
  return d.startsWith('01') && d.length >= 10;
}

export function isCrmSafePhone(raw: string): boolean {
  const d = normalizeCrmPhoneDigits(raw);
  return d.startsWith('050') && d.length >= 10;
}

/** 통화·SMS·lookup — 연락처 우선, 없으면 안심번호 */
export function resolveCrmOutboundPhone(contactPhone: string, safePhone: string): string {
  return contactPhone.trim() || safePhone.trim();
}

/** Inquiry·부재현황 저장 — customerPhone=연락처(없으면 안심), customerPhone2=안심(둘 다 있을 때) */
export function resolveCrmStoredPhones(
  contactPhone: string,
  safePhone: string,
): { customerPhone: string; customerPhone2: string | null } {
  const contact = contactPhone.trim();
  const safe = safePhone.trim();
  return {
    customerPhone: contact || safe || '',
    customerPhone2: contact && safe ? safe : null,
  };
}

/** 숨고 브릿지 추출·레거시 단일 phone → 접수란 필드 */
export function splitSoomgoPhones(data: {
  phone?: string | null;
  mobilePhone?: string | null;
  safePhone?: string | null;
}): { contactPhone: string; safePhone: string } {
  let contact = (data.mobilePhone ?? '').trim();
  let safe = (data.safePhone ?? '').trim();
  const legacy = (data.phone ?? '').trim();
  if (!contact && legacy && isCrmMobilePhone(legacy)) contact = legacy;
  if (!safe && legacy && isCrmSafePhone(legacy)) safe = legacy;
  if (!contact && legacy && !isCrmSafePhone(legacy) && !safe) contact = legacy;
  if (!safe && legacy && isCrmSafePhone(legacy)) safe = legacy;
  return { contactPhone: contact, safePhone: safe };
}
