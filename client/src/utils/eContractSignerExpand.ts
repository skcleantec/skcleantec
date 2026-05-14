/**
 * 서버 `server/src/modules/e-contract/eContractSigner.expand.ts` 와 토큰·치환 로직 동기화.
 */
export const EC_SIGNER_PLACEHOLDER_OPTIONS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '[[EC_SIGNER_NAME]]', label: '(을) 성함' },
  { token: '[[EC_SIGNER_RRN]]', label: '(을) 주민등록번호' },
  { token: '[[EC_SIGNER_ADDRESS]]', label: '(을) 주소' },
  { token: '[[EC_SIGNER_PHONE]]', label: '(을) 연락처' },
  { token: '[[EC_SIGNER_FREETEXT]]', label: '(을) 추가 기재(선택)' },
  { token: '[[EC_SIGNATURE]]', label: '(을) 서명' },
];

export type SignerPreviewFields = {
  name: string;
  residentRegistrationNumber: string;
  addressLine: string;
  phone: string;
  freeTextNotes?: string | null;
  signatureSecureUrl?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function signatureMarkup(url: string): string {
  const u = url.trim().toLowerCase();
  const ok =
    u.length > 0 &&
    u.startsWith('https://') &&
    (u.includes('res.cloudinary.com') || u.includes('/image/upload/v'));
  if (!ok) {
    return '<span class="e-contract-no-sign text-gray-400">(서명 미리보기: 제출 시 반영)</span>';
  }
  const src = escapeHtml(url.trim());
  return `<img src="${src}" alt="서명" class="inline-block max-w-[260px] border border-dashed border-gray-300 bg-white p-1 align-middle" loading="lazy" />`;
}

/** 체결 페이지에서 입력값으로 계약 본문 미리보기 */
export function expandSignerPlaceholdersPreview(html: string, signer: SignerPreviewFields): string {
  let out = (html ?? '').replace(/\r\n/g, '\n');
  const name = escapeHtml((signer.name ?? '').trim());
  const rrn = escapeHtml((signer.residentRegistrationNumber ?? '').trim());
  const addr = escapeHtml((signer.addressLine ?? '').trim());
  const phone = escapeHtml((signer.phone ?? '').trim());
  const notesRaw = (signer.freeTextNotes ?? '').trim();
  const notes = notesRaw ? escapeHtml(notesRaw).replace(/\n/g, '<br />') : '';
  const sig = signatureMarkup(signer.signatureSecureUrl ?? '');

  const rep: Record<string, string> = {
    '[[EC_SIGNER_NAME]]': name || '<span class="text-amber-700">(미입력)</span>',
    '[[EC_SIGNER_RRN]]': rrn || '<span class="text-amber-700">(미입력)</span>',
    '[[EC_SIGNER_ADDRESS]]': addr || '<span class="text-amber-700">(미입력)</span>',
    '[[EC_SIGNER_PHONE]]': phone || '<span class="text-amber-700">(미입력)</span>',
    '[[EC_SIGNER_FREETEXT]]': notes,
    '[[EC_SIGNATURE]]': sig,
  };
  for (const [needle, val] of Object.entries(rep)) {
    out = out.split(needle).join(val);
  }
  return out;
}
