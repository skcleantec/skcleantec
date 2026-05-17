import { stabilizeEContractParagraphHtml } from './eContractBodyParagraphStabilize.js';

/**
 * 발행측(갑) 플레이스홀더 치환 — 서버 표시본·미리보기·배포 시 동일 로직 유지.
 * 클라에도 토큰 문자열 목록 동기화: `EC_ISSUER_PLACEHOLDER_KEYS` (주석 참고).
 */
export type EContractIssuerSnapshot = {
  companyName?: string | null;
  representativeName?: string | null;
  businessRegistrationNo?: string | null;
  addressLine?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  sealPublicId?: string | null;
  sealSecureUrl?: string | null;
  sealDisplayWidthPx?: number | null;
};

export const ISSUER_SEAL_PUBLIC_ID_PREFIX = 'e_contract/issuer/';

const TOKENS = {
  COMPANY: '[[EC_ISSUER_COMPANY]]',
  REP: '[[EC_ISSUER_REP]]',
  BIZNO: '[[EC_ISSUER_BIZNO]]',
  ADDRESS: '[[EC_ISSUER_ADDRESS]]',
  PHONE: '[[EC_ISSUER_PHONE]]',
  FAX: '[[EC_ISSUER_FAX]]',
  EMAIL: '[[EC_ISSUER_EMAIL]]',
  SEAL: '[[EC_ISSUER_SEAL]]',
} as const;

export const EC_ISSUER_PLACEHOLDER_KEYS: ReadonlyArray<{ token: string; label: string }> = [
  { token: TOKENS.COMPANY, label: '상호' },
  { token: TOKENS.REP, label: '대표자' },
  { token: TOKENS.BIZNO, label: '사업자등록번호' },
  { token: TOKENS.ADDRESS, label: '주소' },
  { token: TOKENS.PHONE, label: '전화' },
  { token: TOKENS.FAX, label: '팩스' },
  { token: TOKENS.EMAIL, label: '이메일' },
  { token: TOKENS.SEAL, label: '도장 이미지' },
];

export function issuerSealLooksValid(snapshot: Pick<EContractIssuerSnapshot, 'sealSecureUrl' | 'sealPublicId'>): boolean {
  const url = snapshot.sealSecureUrl?.trim() ?? '';
  const pid = snapshot.sealPublicId?.trim() ?? '';
  if (!url || !pid) return false;
  if (!pid.startsWith(ISSUER_SEAL_PUBLIC_ID_PREFIX)) return false;
  const u = url.toLowerCase();
  return u.includes('res.cloudinary.com') || u.includes('/image/upload/v');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sealImgMarkup(snapshot: EContractIssuerSnapshot): string {
  if (!issuerSealLooksValid(snapshot)) {
    return `<span class="e-contract-no-seal text-gray-500">(도장 미등록)</span>`;
  }
  const url = snapshot.sealSecureUrl!.trim();
  let w = typeof snapshot.sealDisplayWidthPx === 'number' && Number.isFinite(snapshot.sealDisplayWidthPx) ? Math.round(snapshot.sealDisplayWidthPx) : 96;
  if (w < 48) w = 48;
  if (w > 320) w = 320;
  return `<img src="${escapeHtml(url)}" alt="인" width="${w}" class="e-contract-seal-img inline-block align-middle max-w-[40%]" loading="lazy" />`;
}

function textOrDash(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return t ? escapeHtml(t) : '';
}

/**
 * 플레이스홀더를 스냅샷 값으로 교체합니다. null 스냅샷은 전부 빈 치환(도장만 미등록 문구).
 */
export function expandIssuerPlaceholders(html: string, snapshot: EContractIssuerSnapshot | null): string {
  const sn = snapshot ?? {};
  let out = stabilizeEContractParagraphHtml((html ?? '').replace(/\r\n/g, '\n'));
  const rep: Record<string, string> = {
    [TOKENS.COMPANY]: textOrDash(sn.companyName ?? '') || '',
    [TOKENS.REP]: textOrDash(sn.representativeName ?? ''),
    [TOKENS.BIZNO]: textOrDash(sn.businessRegistrationNo ?? ''),
    [TOKENS.ADDRESS]: textOrDash(sn.addressLine ?? ''),
    [TOKENS.PHONE]: textOrDash(sn.phone ?? ''),
    [TOKENS.FAX]: textOrDash(sn.fax ?? ''),
    [TOKENS.EMAIL]: textOrDash(sn.email ?? ''),
    [TOKENS.SEAL]: sealImgMarkup(sn),
  };
  for (const [needle, needleRep] of Object.entries(rep)) {
    out = out.split(needle).join(needleRep);
  }
  return out;
}

export function issuerSnapshotJsonFromPlain(s: EContractIssuerSnapshot | null | undefined): Record<string, string | number | null> {
  const sn = s ?? {};
  const o: Record<string, string | number | null> = {};
  const setStr = (k: string, v: string | null | undefined) => {
    const t = typeof v === 'string' ? v.trim() : '';
    if (t) o[k] = t;
    else o[k] = null;
  };
  setStr('companyName', sn.companyName);
  setStr('representativeName', sn.representativeName);
  setStr('businessRegistrationNo', sn.businessRegistrationNo);
  setStr('addressLine', sn.addressLine);
  setStr('phone', sn.phone);
  setStr('fax', sn.fax);
  setStr('email', sn.email);
  setStr('sealPublicId', sn.sealPublicId);
  setStr('sealSecureUrl', sn.sealSecureUrl);
  if (typeof sn.sealDisplayWidthPx === 'number' && Number.isFinite(sn.sealDisplayWidthPx)) {
    const w = Math.round(sn.sealDisplayWidthPx);
    o.sealDisplayWidthPx = w > 0 ? w : null;
  }
  return o;
}
