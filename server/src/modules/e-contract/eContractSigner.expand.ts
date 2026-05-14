/** 팀장(을) 플레이스홀더 — 계약본문에 포함 후 체결 제출 시 치환됩니다. */
export type SignerFilledFields = {
  name: string;
  residentRegistrationNumber: string;
  addressLine: string;
  phone: string;
  /** 선택 — 초상권·추가 항목 등 장문 자필 확인용 */
  freeTextNotes?: string | null;
  /** 체결 시점 서명 이미지(https, Cloudinary) */
  signatureSecureUrl?: string | null;
};

/** 서버 클라 동기 필수 — `client/src/utils/eContractSignerExpand.ts` */
export const EC_SIGNER_PLACEHOLDER_KEYS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '[[EC_SIGNER_NAME]]', label: '(을) 성함' },
  { token: '[[EC_SIGNER_RRN]]', label: '(을) 주민등록번호' },
  { token: '[[EC_SIGNER_ADDRESS]]', label: '(을) 주소' },
  { token: '[[EC_SIGNER_PHONE]]', label: '(을) 연락처' },
  { token: '[[EC_SIGNER_FREETEXT]]', label: '(을) 추가 기재·동의 세부(선택)' },
  { token: '[[EC_SIGNATURE]]', label: '(을) 서명 이미지' },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 체결 링크 서명 업로드와 동일 — `e_contract/` 접두 */
export function signerSignatureUrlLooksValid(urlRaw: string): boolean {
  const u = urlRaw.trim().toLowerCase();
  return (
    u.length > 0 &&
    u.startsWith('https://') &&
    (u.includes('res.cloudinary.com') || u.includes('/image/upload/v'))
  );
}

function signatureMarkup(url: string): string {
  if (!signerSignatureUrlLooksValid(url)) {
    return '<span class="e-contract-no-sign text-gray-500">(서명 없음)</span>';
  }
  const src = escapeHtml(url.trim());
  return `<img src="${src}" alt="서명" class="e-contract-signer-signature-img inline-block max-w-[260px] align-middle border border-gray-200 bg-white p-1" loading="lazy" />`;
}

/**
 * 버전 표시본(갑 정보 치환 완료) HTML에 을 정보·서명 토큰을 채웁니다.
 */
export function expandSignerPlaceholders(html: string, signer: SignerFilledFields): string {
  let out = (html ?? '').replace(/\r\n/g, '\n');
  const name = escapeHtml((signer.name ?? '').trim());
  const rrn = escapeHtml((signer.residentRegistrationNumber ?? '').trim());
  const addr = escapeHtml((signer.addressLine ?? '').trim());
  const phone = escapeHtml((signer.phone ?? '').trim());
  const notesRaw = (signer.freeTextNotes ?? '').trim();
  const notes = notesRaw ? escapeHtml(notesRaw).replace(/\n/g, '<br />') : '';
  const sig = signatureMarkup(signer.signatureSecureUrl ?? '');

  const rep: Record<string, string> = {
    '[[EC_SIGNER_NAME]]': name,
    '[[EC_SIGNER_RRN]]': rrn,
    '[[EC_SIGNER_ADDRESS]]': addr,
    '[[EC_SIGNER_PHONE]]': phone,
    '[[EC_SIGNER_FREETEXT]]': notes,
    '[[EC_SIGNATURE]]': sig,
  };
  for (const [needle, val] of Object.entries(rep)) {
    out = out.split(needle).join(val);
  }
  return out;
}
