import type { Prisma, EContractIssuerProfile, EContractIssuerStampKind } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  EC_ISSUER_PLACEHOLDER_KEYS,
  ISSUER_SEAL_PUBLIC_ID_PREFIX,
  expandIssuerPlaceholders,
  issuerSealLooksValid,
  issuerSignatureLooksValid,
  issuerSnapshotJsonFromPlain,
  type EContractIssuerSnapshot,
} from './eContractIssuer.expand.js';
import { buildPartyAppendixHtml } from './eContractPartyAppendix.js';

const DEFAULT_PROFILE_KEY = 'default';

export const ISSUER_SEAL_CLOUDINARY_FOLDER = 'e_contract/issuer';

function rowToIssuerSnapshot(row: EContractIssuerProfile): EContractIssuerSnapshot {
  return {
    companyName: row.companyName,
    representativeName: row.representativeName ?? undefined,
    businessRegistrationNo: row.businessRegistrationNo ?? undefined,
    addressLine: row.addressLine ?? undefined,
    phone: row.phone ?? undefined,
    fax: row.fax ?? undefined,
    email: row.email ?? undefined,
    issuerStampKind: row.issuerStampKind === 'SIGNATURE' ? 'SIGNATURE' : 'SEAL',
    sealPublicId: row.sealPublicId ?? undefined,
    sealSecureUrl: row.sealSecureUrl ?? undefined,
    sealDisplayWidthPx: row.sealDisplayWidthPx ?? undefined,
    signaturePublicId: row.signaturePublicId ?? undefined,
    signatureSecureUrl: row.signatureSecureUrl ?? undefined,
    signatureDisplayWidthPx: row.signatureDisplayWidthPx ?? undefined,
  };
}

/** 없으 기본 행을 만듭니다(상호 등은 빈 문자열 허용). */
export async function getIssuerProfile(profileKey = DEFAULT_PROFILE_KEY): Promise<EContractIssuerProfile> {
  let row = await prisma.eContractIssuerProfile.findUnique({
    where: { profileKey },
  });
  if (!row) {
    row = await prisma.eContractIssuerProfile.create({
      data: { profileKey },
    });
  }
  return row;
}

export async function getIssuerProfilePayload(profileKey = DEFAULT_PROFILE_KEY) {
  const row = await getIssuerProfile(profileKey);
  return {
    profile: mapProfileResponse(row),
    placeholders: [...EC_ISSUER_PLACEHOLDER_KEYS],
  };
}

export async function getIssuerSnapshot(profileKey = DEFAULT_PROFILE_KEY): Promise<EContractIssuerSnapshot> {
  const row = await getIssuerProfile(profileKey);
  return rowToIssuerSnapshot(row);
}

/** 관리 초안 미리보기 — 본문 갑 치환 + 하단 계약주·계약자 부록 HTML */
export async function previewBodyWithIssuerProfile(profileKey: string | undefined, bodyMarkdown: string) {
  const row = await getIssuerProfile(profileKey?.trim() || DEFAULT_PROFILE_KEY);
  const snap = rowToIssuerSnapshot(row);
  const expanded = expandIssuerPlaceholders(bodyMarkdown, snap);
  const appendixHtml = buildPartyAppendixHtml(snap);
  return { expanded, appendixHtml };
}

function mapProfileResponse(row: EContractIssuerProfile) {
  return {
    id: row.id,
    profileKey: row.profileKey,
    companyName: row.companyName,
    representativeName: row.representativeName,
    businessRegistrationNo: row.businessRegistrationNo,
    addressLine: row.addressLine,
    phone: row.phone,
    fax: row.fax,
    email: row.email,
    issuerStampKind: row.issuerStampKind,
    sealPublicId: row.sealPublicId,
    sealSecureUrl: row.sealSecureUrl,
    sealDisplayWidthPx: row.sealDisplayWidthPx,
    signaturePublicId: row.signaturePublicId,
    signatureSecureUrl: row.signatureSecureUrl,
    signatureDisplayWidthPx: row.signatureDisplayWidthPx,
    updatedAt: row.updatedAt.toISOString(),
  };
}

type PatchIssuer = Partial<{
  companyName: string;
  representativeName: string | null;
  businessRegistrationNo: string | null;
  addressLine: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  issuerStampKind: EContractIssuerStampKind | 'SEAL' | 'SIGNATURE';
  sealPublicId: string | null;
  sealSecureUrl: string | null;
  sealDisplayWidthPx: number | null;
  clearSeal: boolean;
  signaturePublicId: string | null;
  signatureSecureUrl: string | null;
  signatureDisplayWidthPx: number | null;
  clearSignature: boolean;
}>;

export async function patchIssuerProfile(actorId: string, profileKey: string | undefined, patch: PatchIssuer) {
  const key = (profileKey?.trim() || DEFAULT_PROFILE_KEY).slice(0, 64);
  await getIssuerProfile(key);

  const data: Prisma.EContractIssuerProfileUncheckedUpdateInput = {};

  if (patch.companyName !== undefined) {
    const c = patch.companyName.trim();
    if (!c) {
      throw Object.assign(new Error('company_required'), { code: 'bad_request' as const });
    }
    data.companyName = c.slice(0, 512);
  }

  const setNullable = (src: keyof PatchIssuer, field: keyof Prisma.EContractIssuerProfileUncheckedUpdateInput, maxLen: number) => {
    const raw = patch[src];
    if (raw === undefined) return;
    if (raw === null) {
      (data as Record<string, unknown>)[field as string] = null;
      return;
    }
    if (typeof raw !== 'string') {
      throw Object.assign(new Error('invalid_field'), { code: 'bad_request' as const });
    }
    const t = raw.trim();
    (data as Record<string, unknown>)[field as string] = t ? t.slice(0, maxLen) : null;
  };

  setNullable('representativeName', 'representativeName', 128);
  setNullable('businessRegistrationNo', 'businessRegistrationNo', 32);
  setNullable('addressLine', 'addressLine', 4000);
  setNullable('phone', 'phone', 64);
  setNullable('fax', 'fax', 64);
  setNullable('email', 'email', 256);

  if (patch.issuerStampKind !== undefined) {
    const k = patch.issuerStampKind;
    if (k !== 'SEAL' && k !== 'SIGNATURE') {
      throw Object.assign(new Error('stamp_kind_invalid'), { code: 'bad_request' as const });
    }
    data.issuerStampKind = k as EContractIssuerStampKind;
  }

  if (patch.clearSeal === true) {
    data.sealPublicId = null;
    data.sealSecureUrl = null;
  } else if (patch.sealPublicId !== undefined || patch.sealSecureUrl !== undefined) {
    if (patch.sealPublicId === null && patch.sealSecureUrl === null) {
      data.sealPublicId = null;
      data.sealSecureUrl = null;
    } else {
      const pid = typeof patch.sealPublicId === 'string' ? patch.sealPublicId.trim() : '';
      const surl = typeof patch.sealSecureUrl === 'string' ? patch.sealSecureUrl.trim() : '';
      if (!pid.startsWith(ISSUER_SEAL_PUBLIC_ID_PREFIX)) {
        throw Object.assign(new Error('seal_bad_public_id'), { code: 'bad_request' as const });
      }
      if (!issuerSealLooksValid({ sealPublicId: pid, sealSecureUrl: surl })) {
        throw Object.assign(new Error('seal_bad_url'), { code: 'bad_request' as const });
      }
      data.sealPublicId = pid.slice(0, 512);
      data.sealSecureUrl = surl.slice(0, 2048);
    }
  }

  if (patch.clearSignature === true) {
    data.signaturePublicId = null;
    data.signatureSecureUrl = null;
  } else if (patch.signaturePublicId !== undefined || patch.signatureSecureUrl !== undefined) {
    if (patch.signaturePublicId === null && patch.signatureSecureUrl === null) {
      data.signaturePublicId = null;
      data.signatureSecureUrl = null;
    } else {
      const pid = typeof patch.signaturePublicId === 'string' ? patch.signaturePublicId.trim() : '';
      const surl = typeof patch.signatureSecureUrl === 'string' ? patch.signatureSecureUrl.trim() : '';
      if (!pid.startsWith(ISSUER_SEAL_PUBLIC_ID_PREFIX)) {
        throw Object.assign(new Error('signature_bad_public_id'), { code: 'bad_request' as const });
      }
      if (!issuerSignatureLooksValid({ signaturePublicId: pid, signatureSecureUrl: surl })) {
        throw Object.assign(new Error('signature_bad_url'), { code: 'bad_request' as const });
      }
      data.signaturePublicId = pid.slice(0, 512);
      data.signatureSecureUrl = surl.slice(0, 2048);
    }
  }

  if (patch.sealDisplayWidthPx !== undefined) {
    if (patch.sealDisplayWidthPx === null) {
      data.sealDisplayWidthPx = null;
    } else if (typeof patch.sealDisplayWidthPx === 'number' && Number.isFinite(patch.sealDisplayWidthPx)) {
      const w = Math.round(patch.sealDisplayWidthPx);
      if (w < 48 || w > 320) {
        throw Object.assign(new Error('seal_width_range'), { code: 'bad_request' as const });
      }
      data.sealDisplayWidthPx = w;
    } else {
      throw Object.assign(new Error('seal_width_invalid'), { code: 'bad_request' as const });
    }
  }

  if (patch.signatureDisplayWidthPx !== undefined) {
    if (patch.signatureDisplayWidthPx === null) {
      data.signatureDisplayWidthPx = null;
    } else if (typeof patch.signatureDisplayWidthPx === 'number' && Number.isFinite(patch.signatureDisplayWidthPx)) {
      const w = Math.round(patch.signatureDisplayWidthPx);
      if (w < 48 || w > 320) {
        throw Object.assign(new Error('signature_width_range'), { code: 'bad_request' as const });
      }
      data.signatureDisplayWidthPx = w;
    } else {
      throw Object.assign(new Error('signature_width_invalid'), { code: 'bad_request' as const });
    }
  }

  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('nothing_to_patch'), { code: 'bad_request' as const });
  }

  data.updatedById = actorId;

  await prisma.eContractIssuerProfile.update({
    where: { profileKey: key },
    data,
  });

  const row = await prisma.eContractIssuerProfile.findUniqueOrThrow({
    where: { profileKey: key },
  });
  return mapProfileResponse(row);
}

/** 배포 시 저장할 JSON 및 치환용 스냅샷 */
export async function issuerSnapshotBlockForPublish(
  profileKey = DEFAULT_PROFILE_KEY
): Promise<{ snapshotJson: Record<string, string | number | null>; plain: EContractIssuerSnapshot }> {
  const row = await getIssuerProfile(profileKey);
  const plain = rowToIssuerSnapshot(row);
  const snapshotJson = issuerSnapshotJsonFromPlain(plain);
  return { snapshotJson, plain };
}
