import type { EContractFieldInputType } from '@prisma/client';
import type { ResolvedFieldForBody } from './eContractFieldDefinition.service.js';
import { EC_SIGNATURE_TOKEN } from './eContractField.tokens.js';

/** 레거시 호환 — 고정 필드 구조 */
export type ValidatedSignerSubmissionFields = {
  name: string;
  residentRegistrationNumber: string;
  addressLine: string;
  phone: string;
  freeTextNotes: string | null;
};

export type DynamicSignerValidationResult = {
  byToken: Record<string, string>;
  legacy: ValidatedSignerSubmissionFields;
};

const LEGACY_TOKEN_MAP: Record<string, keyof ValidatedSignerSubmissionFields> = {
  '[[EC_SIGNER_NAME]]': 'name',
  '[[EC_SIGNER_RRN]]': 'residentRegistrationNumber',
  '[[EC_SIGNER_ADDRESS]]': 'addressLine',
  '[[EC_SIGNER_PHONE]]': 'phone',
  '[[EC_SIGNER_FREETEXT]]': 'freeTextNotes',
};

function normalizePhone(raw: string): string {
  return raw.replace(/\s/g, '').trim();
}

function normalizeRrn(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length !== 13) {
    throw Object.assign(new Error('signer_rrn'), { code: 'bad_request' as const });
  }
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function validateOneField(field: ResolvedFieldForBody, rawVal: unknown): string {
  const str = typeof rawVal === 'string' ? rawVal.trim().replace(/\r\n/g, '\n') : '';
  if (!str) {
    if (field.required) {
      throw Object.assign(new Error(`signer_field:${field.token}`), { code: 'bad_request' as const });
    }
    return '';
  }

  switch (field.inputType) {
    case 'RRN':
      return normalizeRrn(str);
    case 'PHONE':
      if (str.length > 32) throw Object.assign(new Error(`signer_field:${field.token}`), { code: 'bad_request' as const });
      return normalizePhone(str);
    case 'TEXTAREA':
      if (str.length > 4000) throw Object.assign(new Error(`signer_field:${field.token}`), { code: 'bad_request' as const });
      return str;
    case 'NUMBER':
      if (!/^-?\d+(\.\d+)?$/.test(str.replace(/,/g, ''))) {
        throw Object.assign(new Error(`signer_field:${field.token}`), { code: 'bad_request' as const });
      }
      return str.replace(/,/g, '');
    case 'DATE':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str) && !/^\d{4}년/.test(str)) {
        throw Object.assign(new Error(`signer_field:${field.token}`), { code: 'bad_request' as const });
      }
      return str;
    default:
      if (str.length > 2000) throw Object.assign(new Error(`signer_field:${field.token}`), { code: 'bad_request' as const });
      return str;
  }
}

export function validateDynamicSignerFields(
  body: Record<string, unknown>,
  signFields: ResolvedFieldForBody[]
): DynamicSignerValidationResult {
  const signerFieldsRaw =
    body.signerFields && typeof body.signerFields === 'object' && !Array.isArray(body.signerFields)
      ? (body.signerFields as Record<string, unknown>)
      : null;

  const byToken: Record<string, string> = {};

  for (const field of signFields) {
    if (field.token === EC_SIGNATURE_TOKEN) continue;
    let raw: unknown;
    if (signerFieldsRaw && field.token in signerFieldsRaw) {
      raw = signerFieldsRaw[field.token];
    } else {
      raw = legacyBodyValueForToken(body, field.token);
    }
    const val = validateOneField(field, raw);
    if (val) byToken[field.token] = val;
  }

  const legacy: ValidatedSignerSubmissionFields = {
    name: byToken['[[EC_SIGNER_NAME]]'] ?? legacyString(body.signerName),
    residentRegistrationNumber:
      byToken['[[EC_SIGNER_RRN]]'] ??
      (typeof body.signerResidentRegistrationNumber === 'string'
        ? normalizeRrn(body.signerResidentRegistrationNumber)
        : ''),
    addressLine: byToken['[[EC_SIGNER_ADDRESS]]'] ?? legacyString(body.signerAddressLine),
    phone: byToken['[[EC_SIGNER_PHONE]]'] ?? normalizePhone(legacyString(body.signerPhone)),
    freeTextNotes: byToken['[[EC_SIGNER_FREETEXT]]'] ?? legacyOptionalNotes(body.signerFreeTextNotes),
  };

  if (signFields.some((f) => f.token === '[[EC_SIGNER_NAME]]' && f.required) && (!legacy.name || legacy.name.length > 128)) {
    throw Object.assign(new Error('signer_name'), { code: 'bad_request' as const });
  }
  if (signFields.some((f) => f.token === '[[EC_SIGNER_RRN]]' && f.required) && !legacy.residentRegistrationNumber) {
    throw Object.assign(new Error('signer_rrn'), { code: 'bad_request' as const });
  }
  if (signFields.some((f) => f.token === '[[EC_SIGNER_ADDRESS]]' && f.required) && !legacy.addressLine) {
    throw Object.assign(new Error('signer_address'), { code: 'bad_request' as const });
  }
  if (signFields.some((f) => f.token === '[[EC_SIGNER_PHONE]]' && f.required) && !legacy.phone) {
    throw Object.assign(new Error('signer_phone'), { code: 'bad_request' as const });
  }

  for (const [token, key] of Object.entries(LEGACY_TOKEN_MAP)) {
    const v = legacy[key];
    if (typeof v === 'string' && v.trim()) byToken[token] = v.trim();
    else if (key === 'freeTextNotes' && v) byToken[token] = v;
  }

  return { byToken, legacy };
}

function legacyString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function legacyOptionalNotes(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') throw Object.assign(new Error('signer_notes'), { code: 'bad_request' as const });
  const t = v.trim().replace(/\r\n/g, '\n');
  return t ? t.slice(0, 4000) : null;
}

function legacyBodyValueForToken(body: Record<string, unknown>, token: string): unknown {
  switch (token) {
    case '[[EC_SIGNER_NAME]]':
      return body.signerName;
    case '[[EC_SIGNER_RRN]]':
      return body.signerResidentRegistrationNumber;
    case '[[EC_SIGNER_ADDRESS]]':
      return body.signerAddressLine;
    case '[[EC_SIGNER_PHONE]]':
      return body.signerPhone;
    case '[[EC_SIGNER_FREETEXT]]':
      return body.signerFreeTextNotes;
    default:
      return undefined;
  }
}

export function validateSignerSubmissionBody(b: Record<string, unknown>): ValidatedSignerSubmissionFields {
  const nameRaw = typeof b.signerName === 'string' ? b.signerName : '';
  const name = nameRaw.trim();
  if (!name || name.length > 128) {
    throw Object.assign(new Error('signer_name'), { code: 'bad_request' as const });
  }
  const residentRegistrationNumber = normalizeRrn(
    typeof b.signerResidentRegistrationNumber === 'string' ? b.signerResidentRegistrationNumber : ''
  );
  const addrRaw = typeof b.signerAddressLine === 'string' ? b.signerAddressLine : '';
  const addressLine = addrRaw.trim().replace(/\r\n/g, '\n');
  if (!addressLine || addressLine.length > 2000) {
    throw Object.assign(new Error('signer_address'), { code: 'bad_request' as const });
  }
  const phone = normalizePhone(typeof b.signerPhone === 'string' ? b.signerPhone : '');
  if (!phone || phone.length > 32) {
    throw Object.assign(new Error('signer_phone'), { code: 'bad_request' as const });
  }
  let freeTextNotes: string | null = null;
  if ('signerFreeTextNotes' in b && b.signerFreeTextNotes != null) {
    freeTextNotes = legacyOptionalNotes(b.signerFreeTextNotes);
  }
  return { name, residentRegistrationNumber, addressLine, phone, freeTextNotes };
}

export function signerFieldErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'signer_name') return '을(본인) 성함을 입력해 주세요.';
  if (msg === 'signer_rrn') return '주민등록번호 13자리를 입력해 주세요.';
  if (msg === 'signer_address') return '주소를 입력해 주세요.';
  if (msg === 'signer_phone') return '연락처를 입력해 주세요.';
  if (msg === 'signer_notes') return '추가 기재 내용 형식이 올바르지 않습니다.';
  if (msg.startsWith('signer_field:')) return '필수 입력 항목을 확인해 주세요.';
  return '을(본인) 정보를 확인해 주세요.';
}

export type PublicSignFieldDto = {
  token: string;
  label: string;
  inputType: EContractFieldInputType;
  required: boolean;
  prefill?: string;
};

export function toPublicSignFields(
  fields: ResolvedFieldForBody[],
  prefillName?: string
): PublicSignFieldDto[] {
  return fields
    .filter((f) => f.filledBy === 'SIGNER' && f.token !== EC_SIGNATURE_TOKEN)
    .map((f) => ({
      token: f.token,
      label: f.label,
      inputType: f.inputType,
      required: f.required,
      ...(f.token === '[[EC_SIGNER_NAME]]' && prefillName?.trim()
        ? { prefill: prefillName.trim() }
        : {}),
    }));
}
