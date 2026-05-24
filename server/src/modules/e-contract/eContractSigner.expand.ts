import {
  EC_SIGNER_FREETEXT_ROW_TOKEN,
  expandEcTokenMap,
  freeTextNotesRowMarkup,
} from './eContractDynamicExpand.js';
import { EC_SIGNATURE_TOKEN } from './eContractField.tokens.js';

/** 팀장(을) 플레이스홀더 — 계약본문에 포함 후 체결 제출 시 치환됩니다. */
export type SignerFilledFields = {
  name: string;
  residentRegistrationNumber: string;
  addressLine: string;
  phone: string;
  freeTextNotes?: string | null;
  signatureSecureUrl?: string | null;
};

/** 서버·클라 동기 — `client/src/utils/eContractSignerExpand.ts` */
export const EC_SIGNER_PLACEHOLDER_KEYS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '[[EC_SIGNER_NAME]]', label: '(을) 성함' },
  { token: '[[EC_SIGNER_RRN]]', label: '(을) 주민등록번호' },
  { token: '[[EC_SIGNER_ADDRESS]]', label: '(을) 주소' },
  { token: '[[EC_SIGNER_PHONE]]', label: '(을) 연락처' },
  { token: '[[EC_SIGNER_FREETEXT]]', label: '(을) 추가 기재·동의 세부(선택)' },
  { token: '[[EC_SIGNATURE]]', label: '(을) 서명 이미지' },
];

export function signerSignatureUrlLooksValid(urlRaw: string): boolean {
  const u = urlRaw.trim().toLowerCase();
  return (
    u.length > 0 &&
    u.startsWith('https://') &&
    (u.includes('res.cloudinary.com') || u.includes('/image/upload/v'))
  );
}

function signerToTokenMap(signer: SignerFilledFields): Record<string, string> {
  const notesRaw = (signer.freeTextNotes ?? '').trim();
  return {
    '[[EC_SIGNER_NAME]]': (signer.name ?? '').trim(),
    '[[EC_SIGNER_RRN]]': (signer.residentRegistrationNumber ?? '').trim(),
    '[[EC_SIGNER_ADDRESS]]': (signer.addressLine ?? '').trim(),
    '[[EC_SIGNER_PHONE]]': (signer.phone ?? '').trim(),
    '[[EC_SIGNER_FREETEXT]]': notesRaw,
    [EC_SIGNER_FREETEXT_ROW_TOKEN]: freeTextNotesRowMarkup(notesRaw),
    [EC_SIGNATURE_TOKEN]: (signer.signatureSecureUrl ?? '').trim(),
  };
}

export function expandSignerPlaceholders(html: string, signer: SignerFilledFields): string {
  return expandEcTokenMap(html, signerToTokenMap(signer));
}

export function expandEcTokenValues(html: string, values: Record<string, string>): string {
  const notes = values['[[EC_SIGNER_FREETEXT]]'] ?? '';
  const withRow = { ...values, [EC_SIGNER_FREETEXT_ROW_TOKEN]: freeTextNotesRowMarkup(notes) };
  return expandEcTokenMap(html, withRow);
}
