/** POST /submit 본문 — 을(팀장) 필드 검증만 담당 */
export type ValidatedSignerSubmissionFields = {
  name: string;
  residentRegistrationNumber: string;
  addressLine: string;
  phone: string;
  freeTextNotes: string | null;
};

export function validateSignerSubmissionBody(b: Record<string, unknown>): ValidatedSignerSubmissionFields {
  const nameRaw = typeof b.signerName === 'string' ? b.signerName : '';
  const name = nameRaw.trim();
  if (!name || name.length > 128) {
    throw Object.assign(new Error('signer_name'), { code: 'bad_request' as const });
  }

  const ridIn =
    typeof b.signerResidentRegistrationNumber === 'string' ? b.signerResidentRegistrationNumber : '';
  const ridDigits = ridIn.replace(/[^\d]/g, '');
  if (ridDigits.length !== 13) {
    throw Object.assign(new Error('signer_rrn'), { code: 'bad_request' as const });
  }
  const residentRegistrationNumber = `${ridDigits.slice(0, 6)}-${ridDigits.slice(6)}`;

  const addrRaw = typeof b.signerAddressLine === 'string' ? b.signerAddressLine : '';
  const addressLine = addrRaw.trim().replace(/\r\n/g, '\n');
  if (!addressLine || addressLine.length > 2000) {
    throw Object.assign(new Error('signer_address'), { code: 'bad_request' as const });
  }

  const phoneRaw = typeof b.signerPhone === 'string' ? b.signerPhone.replace(/\s/g, '') : '';
  const phone = phoneRaw.trim();
  if (!phone || phone.length > 32) {
    throw Object.assign(new Error('signer_phone'), { code: 'bad_request' as const });
  }

  let freeTextNotes: string | null = null;
  if ('signerFreeTextNotes' in b && b.signerFreeTextNotes != null) {
    if (typeof b.signerFreeTextNotes !== 'string') {
      throw Object.assign(new Error('signer_notes'), { code: 'bad_request' as const });
    }
    const t = b.signerFreeTextNotes.trim().replace(/\r\n/g, '\n');
    freeTextNotes = t ? t.slice(0, 4000) : null;
  }

  return {
    name,
    residentRegistrationNumber,
    addressLine,
    phone,
    freeTextNotes,
  };
}
