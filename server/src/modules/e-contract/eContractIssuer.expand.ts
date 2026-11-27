import { tenantCompanySealLooksValid } from '../../lib/quotationSeal.js';
import { isHttpsHostedImageUrl, isLikelyStoredContractImage } from '../../lib/storedObjectUrl.js';
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
  /** 저장값. (인) 칸 이미지는 이 값이 SIGNATURE여도 서명 이미지를 쓰지 않는다. */
  issuerStampKind?: EContractIssuerStampKind | null;
  /** 직인 폴더 검사에 쓴다. */
  tenantId?: string | null;
  sealPublicId?: string | null;
  sealSecureUrl?: string | null;
  sealDisplayWidthPx?: number | null;
  signaturePublicId?: string | null;
  signatureSecureUrl?: string | null;
  signatureDisplayWidthPx?: number | null;
  /** 업체 등록정보의 직인. 발급자 도장이 없을 때 (인) 칸에 쓴다. */
  companySealPublicId?: string | null;
  companySealSecureUrl?: string | null;
  companySealDisplayWidthPx?: number | null;
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
  return isLikelyStoredContractImage(urlRaw ?? '', publicIdRaw ?? '', 'e_contract/issuer');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SEAL_WIDTH_MIN = 48;
const SEAL_WIDTH_MAX = 120;
const SEAL_WIDTH_DEFAULT = 60;

function sealDisplayWidth(raw: number | null | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return SEAL_WIDTH_DEFAULT;
  const w = Math.round(raw);
  if (w < SEAL_WIDTH_MIN) return SEAL_WIDTH_MIN;
  if (w > SEAL_WIDTH_MAX) return SEAL_WIDTH_MAX;
  return w;
}

/** 막힌 예전 저장소. 다음 도장 후보로 넘긴다. */
function isBlockedLegacySealUrl(url: string): boolean {
  return url.toLowerCase().includes('res.cloudinary.com');
}

type SealImage = { url: string; width: number };

function issuerSealCandidate(snapshot: EContractIssuerSnapshot): SealImage | null {
  if (!issuerSealLooksValid(snapshot)) return null;
  const url = snapshot.sealSecureUrl!.trim();
  if (!isHttpsHostedImageUrl(url) || isBlockedLegacySealUrl(url)) return null;
  return { url, width: sealDisplayWidth(snapshot.sealDisplayWidthPx) };
}

function companySealCandidate(snapshot: EContractIssuerSnapshot): SealImage | null {
  const tenantId = (snapshot.tenantId ?? '').trim();
  const url = (snapshot.companySealSecureUrl ?? '').trim();
  const publicId = (snapshot.companySealPublicId ?? '').trim();
  if (!tenantId || !tenantCompanySealLooksValid(publicId, url, tenantId)) return null;
  if (!isHttpsHostedImageUrl(url) || isBlockedLegacySealUrl(url)) return null;
  return { url, width: sealDisplayWidth(snapshot.companySealDisplayWidthPx) };
}

function sealImgMarkup(image: SealImage): string {
  const w = image.width;
  return `<img src="${escapeHtml(image.url)}" alt="인" width="${w}" crossorigin="anonymous" class="e-contract-seal-img" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${w}px;height:auto;max-width:none;" />`;
}

/** `[[EC_ISSUER_SEAL]]` — 발급자 도장, 없으면 업체 직인. 없으면 빈 문자열. 서명 이미지는 쓰지 않는다. */
function issuerStampSlotMarkup(snapshot: EContractIssuerSnapshot): string {
  const image = issuerSealCandidate(snapshot) ?? companySealCandidate(snapshot);
  if (!image) return '';
  return sealImgMarkup(image);
}

function textOrDash(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return t ? escapeHtml(t) : '';
}

/**
 * 플레이스홀더를 스냅샷 값으로 교체합니다. 도장이 없으면 (인) 칸 이미지는 빈 문자열이다.
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
  setStr('tenantId', sn.tenantId);
  setStr('sealPublicId', sn.sealPublicId);
  setStr('sealSecureUrl', sn.sealSecureUrl);
  setStr('companySealPublicId', sn.companySealPublicId);
  setStr('companySealSecureUrl', sn.companySealSecureUrl);
  setStr('signaturePublicId', sn.signaturePublicId);
  setStr('signatureSecureUrl', sn.signatureSecureUrl);
  if (typeof sn.sealDisplayWidthPx === 'number' && Number.isFinite(sn.sealDisplayWidthPx)) {
    const w = Math.round(sn.sealDisplayWidthPx);
    o.sealDisplayWidthPx = w > 0 ? w : null;
  } else o.sealDisplayWidthPx = null;
  if (typeof sn.companySealDisplayWidthPx === 'number' && Number.isFinite(sn.companySealDisplayWidthPx)) {
    const w = Math.round(sn.companySealDisplayWidthPx);
    o.companySealDisplayWidthPx = w > 0 ? w : null;
  } else o.companySealDisplayWidthPx = null;
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
    tenantId: pickStr('tenantId'),
    sealPublicId: pickStr('sealPublicId'),
    sealSecureUrl: pickStr('sealSecureUrl'),
    sealDisplayWidthPx:
      typeof o.sealDisplayWidthPx === 'number' && Number.isFinite(o.sealDisplayWidthPx)
        ? Math.round(o.sealDisplayWidthPx)
        : undefined,
    companySealPublicId: pickStr('companySealPublicId'),
    companySealSecureUrl: pickStr('companySealSecureUrl'),
    companySealDisplayWidthPx:
      typeof o.companySealDisplayWidthPx === 'number' && Number.isFinite(o.companySealDisplayWidthPx)
        ? Math.round(o.companySealDisplayWidthPx)
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
