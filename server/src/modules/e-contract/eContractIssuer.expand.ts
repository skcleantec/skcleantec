import { stabilizeEContractParagraphHtml } from './eContractBodyParagraphStabilize.js';

/** DB·스냅샷과 동기 — Prisma `EContractIssuerStampKind` */
export type EContractIssuerStampKind = 'SEAL' | 'SIGNATURE';

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
  /** 갑 (인) 칸에 도장 또는 서명 이미지 중 무엇을 쓸지 */
  issuerStampKind?: EContractIssuerStampKind | null;
  sealPublicId?: string | null;
  sealSecureUrl?: string | null;
  sealDisplayWidthPx?: number | null;
  signaturePublicId?: string | null;
  signatureSecureUrl?: string | null;
  signatureDisplayWidthPx?: number | null;
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
  { token: TOKENS.SEAL, label: '갑 인감 — 도장 또는 서명 이미지' },
];

export function issuerSealLooksValid(snapshot: Pick<EContractIssuerSnapshot, 'sealSecureUrl' | 'sealPublicId'>): boolean {
  return issuerIssuerFolderImageLooksValid(snapshot.sealPublicId, snapshot.sealSecureUrl);
}

export function issuerSignatureLooksValid(
  snapshot: Pick<EContractIssuerSnapshot, 'signatureSecureUrl' | 'signaturePublicId'>
): boolean {
  return issuerIssuerFolderImageLooksValid(snapshot.signaturePublicId, snapshot.signatureSecureUrl);
}

function issuerIssuerFolderImageLooksValid(publicIdRaw: string | null | undefined, urlRaw: string | null | undefined): boolean {
  const url = (urlRaw ?? '').trim().toLowerCase();
  const pid = (publicIdRaw ?? '').trim();
  if (!url || !pid) return false;
  if (!pid.startsWith(ISSUER_SEAL_PUBLIC_ID_PREFIX)) return false;
  return url.includes('res.cloudinary.com') || url.includes('/image/upload/v');
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
  let w =
    typeof snapshot.sealDisplayWidthPx === 'number' && Number.isFinite(snapshot.sealDisplayWidthPx)
      ? Math.round(snapshot.sealDisplayWidthPx)
      : 96;
  if (w < 48) w = 48;
  if (w > 320) w = 320;
  return `<img src="${escapeHtml(url)}" alt="인" width="${w}" crossorigin="anonymous" class="e-contract-seal-img inline-block align-middle max-w-[40%]" loading="lazy" />`;
}

function signatureImgMarkup(snapshot: EContractIssuerSnapshot): string {
  if (!issuerSignatureLooksValid(snapshot)) {
    return `<span class="e-contract-no-sign text-gray-500">(서명 미등록)</span>`;
  }
  const url = snapshot.signatureSecureUrl!.trim();
  let w =
    typeof snapshot.signatureDisplayWidthPx === 'number' && Number.isFinite(snapshot.signatureDisplayWidthPx)
      ? Math.round(snapshot.signatureDisplayWidthPx)
      : 96;
  if (w < 48) w = 48;
  if (w > 320) w = 320;
  return `<img src="${escapeHtml(url)}" alt="서명" width="${w}" crossorigin="anonymous" class="e-contract-issuer-signature-img inline-block align-middle max-w-[260px]" loading="lazy" />`;
}

/** `[[EC_ISSUER_SEAL]]` — 설정에 따라 도장 또는 서명 이미지 */
function issuerStampSlotMarkup(snapshot: EContractIssuerSnapshot): string {
  const kind = snapshot.issuerStampKind ?? 'SEAL';
  if (kind === 'SIGNATURE') return signatureImgMarkup(snapshot);
  return sealImgMarkup(snapshot);
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
    [TOKENS.SEAL]: issuerStampSlotMarkup(sn),
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
  const kind = sn.issuerStampKind === 'SIGNATURE' ? 'SIGNATURE' : 'SEAL';
  o.issuerStampKind = kind;
  setStr('companyName', sn.companyName);
  setStr('representativeName', sn.representativeName);
  setStr('businessRegistrationNo', sn.businessRegistrationNo);
  setStr('addressLine', sn.addressLine);
  setStr('phone', sn.phone);
  setStr('fax', sn.fax);
  setStr('email', sn.email);
  setStr('sealPublicId', sn.sealPublicId);
  setStr('sealSecureUrl', sn.sealSecureUrl);
  setStr('signaturePublicId', sn.signaturePublicId);
  setStr('signatureSecureUrl', sn.signatureSecureUrl);
  if (typeof sn.sealDisplayWidthPx === 'number' && Number.isFinite(sn.sealDisplayWidthPx)) {
    const w = Math.round(sn.sealDisplayWidthPx);
    o.sealDisplayWidthPx = w > 0 ? w : null;
  } else o.sealDisplayWidthPx = null;
  if (typeof sn.signatureDisplayWidthPx === 'number' && Number.isFinite(sn.signatureDisplayWidthPx)) {
    const w = Math.round(sn.signatureDisplayWidthPx);
    o.signatureDisplayWidthPx = w > 0 ? w : null;
  } else o.signatureDisplayWidthPx = null;
  return o;
}

/** 배포본에 저장된 `issuer_snapshot` JSON → 치환용 스냅샷 (형식 불명 시 null) */
export function issuerSnapshotFromStoredJson(raw: unknown): EContractIssuerSnapshot | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const pickStr = (k: string): string | undefined => {
    const v = o[k];
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t || undefined;
  };
  const kindRaw = o.issuerStampKind;
  const issuerStampKind: EContractIssuerStampKind =
    kindRaw === 'SIGNATURE' ? 'SIGNATURE' : 'SEAL';
  const snap: EContractIssuerSnapshot = {
    issuerStampKind,
    companyName: pickStr('companyName'),
    representativeName: pickStr('representativeName'),
    businessRegistrationNo: pickStr('businessRegistrationNo'),
    addressLine: pickStr('addressLine'),
    phone: pickStr('phone'),
    fax: pickStr('fax'),
    email: pickStr('email'),
    sealPublicId: pickStr('sealPublicId'),
    sealSecureUrl: pickStr('sealSecureUrl'),
    sealDisplayWidthPx:
      typeof o.sealDisplayWidthPx === 'number' && Number.isFinite(o.sealDisplayWidthPx)
        ? Math.round(o.sealDisplayWidthPx)
        : undefined,
    signaturePublicId: pickStr('signaturePublicId'),
    signatureSecureUrl: pickStr('signatureSecureUrl'),
    signatureDisplayWidthPx:
      typeof o.signatureDisplayWidthPx === 'number' && Number.isFinite(o.signatureDisplayWidthPx)
        ? Math.round(o.signatureDisplayWidthPx)
        : undefined,
  };
  return snap;
}
