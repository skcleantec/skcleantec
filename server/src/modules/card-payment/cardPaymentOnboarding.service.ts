import { randomBytes } from 'node:crypto';
import type { Prisma, TenantPgOnboarding, TenantPgOnboardingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  destroyBusinessRegistrationPublicId,
  uploadBusinessRegistrationBuffer,
  assertBusinessRegistrationImageMime,
} from '../onboarding/businessRegistration.service.js';
import { serializeOnboarding } from './cardPayment.serialize.js';

const ONBOARDING_FIELDS = [
  'businessName',
  'bizNumber',
  'representativeName',
  'representativeBirth',
  'addressLine',
  'contactName',
  'contactPhone',
  'contactEmail',
  'bankName',
  'bankAccount',
  'accountHolder',
  'websiteUrl',
  'note',
] as const;

const PG_BUSINESS_KINDS = ['CORPORATE', 'SOLE_PROPRIETOR'] as const;
type PgBusinessKind = (typeof PG_BUSINESS_KINDS)[number];

function readBusinessKind(input: OnboardingInput): PgBusinessKind | null {
  const raw = typeof input.businessKind === 'string' ? input.businessKind.trim() : '';
  return PG_BUSINESS_KINDS.includes(raw as PgBusinessKind) ? (raw as PgBusinessKind) : null;
}

function consentStamp(flag: boolean | undefined, existing: Date | null | undefined, now: Date) {
  if (flag === true) return existing ?? now;
  if (flag === false) return null;
  return existing ?? null;
}

export type OnboardingInput = Partial<Record<(typeof ONBOARDING_FIELDS)[number], string | null>> & {
  businessKind?: string | null;
  consentTerms?: boolean;
  consentPrivacy?: boolean;
  consentThirdParty?: boolean;
  consentIllegalUse?: boolean;
  consentMarketing?: boolean;
};

function newReviewToken(): string {
  return randomBytes(24).toString('base64url');
}

async function withReviewToken(row: TenantPgOnboarding): Promise<TenantPgOnboarding> {
  if (row.status === 'DRAFT' || row.reviewToken) return row;
  return prisma.tenantPgOnboarding.update({
    where: { id: row.id },
    data: { reviewToken: newReviewToken() },
  });
}

async function registrationImageUrl(tenantId: string): Promise<string | null> {
  const biz = await prisma.tenantSignupBusiness.findFirst({
    where: { tenantId },
    select: { businessRegistrationImageUrl: true },
  });
  const url = biz?.businessRegistrationImageUrl?.trim();
  return url || null;
}

async function serializeWithRegistration(tenantId: string, row: TenantPgOnboarding) {
  return {
    ...serializeOnboarding(row),
    businessRegistrationImageUrl: await registrationImageUrl(tenantId),
  };
}

export async function saveTenantRegistrationImage(tenantId: string, buffer: Buffer, mimetype: string) {
  assertBusinessRegistrationImageMime(mimetype);
  const existing = await prisma.tenantSignupBusiness.findFirst({
    where: { tenantId },
    select: { id: true, businessRegistrationImagePublicId: true },
  });
  const uploaded = await uploadBusinessRegistrationBuffer({
    folder: `cbiseo/signup-business-registration/${tenantId}`,
    buffer,
    mimetype,
  });
  if (existing) {
    await prisma.tenantSignupBusiness.update({
      where: { tenantId },
      data: {
        businessRegistrationImageUrl: uploaded.secureUrl,
        businessRegistrationImagePublicId: uploaded.publicId,
      },
    });
    if (existing.businessRegistrationImagePublicId && existing.businessRegistrationImagePublicId !== uploaded.publicId) {
      await destroyBusinessRegistrationPublicId(existing.businessRegistrationImagePublicId);
    }
  } else {
    await prisma.tenantSignupBusiness.create({
      data: {
        tenantId,
        businessType: 'registered_business',
        businessRegistrationImageUrl: uploaded.secureUrl,
        businessRegistrationImagePublicId: uploaded.publicId,
        submittedAt: new Date(),
      },
    });
  }
  return { businessRegistrationImageUrl: uploaded.secureUrl };
}

export async function getOrPrefillOnboarding(tenantId: string) {
  const existing = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId } });
  if (existing) return serializeWithRegistration(tenantId, await withReviewToken(existing));

  const biz = await prisma.tenantSignupBusiness.findFirst({ where: { tenantId } });
  const created = await prisma.tenantPgOnboarding.create({
    data: {
      tenantId,
      businessName: biz?.businessName ?? null,
      bizNumber: biz?.bizNumber ?? null,
      representativeName: biz?.representativeName ?? null,
      addressLine: biz?.addressLine ?? null,
    },
  });
  return serializeWithRegistration(tenantId, created);
}

export async function saveOnboardingDraft(tenantId: string, input: OnboardingInput) {
  const now = new Date();
  const existing = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId } });
  const data = { ...pickOnboarding(input), ...applyApplicationExtras(input, existing, now) };
  const row = await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
  return serializeWithRegistration(tenantId, row);
}

export async function submitOnboarding(tenantId: string, input: OnboardingInput) {
  const imageUrl = await registrationImageUrl(tenantId);
  if (!imageUrl) {
    throw new Error('사업자등록증을 등록해 주세요.');
  }
  const now = new Date();
  const existing = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId } });
  const extras = applyApplicationExtras(input, existing, now);
  const kind = readBusinessKind(input) ?? (existing?.businessKind === 'CORPORATE' || existing?.businessKind === 'SOLE_PROPRIETOR' ? existing.businessKind : null);
  if (!kind) throw new Error('법인 사업자 또는 개인 사업자를 선택해 주세요. 사업자가 없는 개인은 신청할 수 없습니다.');
  const picked = pickOnboarding(input);
  const name = (typeof picked.businessName === 'string' ? picked.businessName : existing?.businessName) ?? '';
  const bizNumber = (typeof picked.bizNumber === 'string' ? picked.bizNumber : existing?.bizNumber) ?? '';
  const representative = (typeof picked.representativeName === 'string' ? picked.representativeName : existing?.representativeName) ?? '';
  const phone = (typeof picked.contactPhone === 'string' ? picked.contactPhone : existing?.contactPhone) ?? '';
  const email = (typeof picked.contactEmail === 'string' ? picked.contactEmail : existing?.contactEmail) ?? '';
  if (!name.trim() || !bizNumber.trim() || !representative.trim() || !phone.trim() || !email.trim()) {
    throw new Error('상호, 사업자등록번호, 대표자, 휴대전화, 이메일을 입력해 주세요.');
  }
  const cardUrl = existing?.businessCardImageUrl?.trim();
  if (!cardUrl) throw new Error('명함을 올려 주세요.');
  const agreed = {
    terms: input.consentTerms === true || Boolean(existing?.consentTermsAt),
    privacy: input.consentPrivacy === true || Boolean(existing?.consentPrivacyAt),
    third: input.consentThirdParty === true || Boolean(existing?.consentThirdPartyAt),
    illegal: input.consentIllegalUse === true || Boolean(existing?.consentIllegalUseAt),
  };
  if (input.consentTerms === false || input.consentPrivacy === false || input.consentThirdParty === false || input.consentIllegalUse === false) {
    throw new Error('필수 동의 항목을 확인해 주세요.');
  }
  if (!agreed.terms || !agreed.privacy || !agreed.third || !agreed.illegal) {
    throw new Error('필수 동의 항목을 확인해 주세요.');
  }
  const reviewToken = existing?.reviewToken ?? newReviewToken();
  const row = await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: { tenantId, ...picked, ...extras, businessKind: kind, status: 'SUBMITTED', submittedAt: now, reviewToken },
    update: { ...picked, ...extras, businessKind: kind, status: 'SUBMITTED', submittedAt: now, reviewToken },
  });
  return serializeWithRegistration(tenantId, row);
}

export async function saveTenantBusinessCard(tenantId: string, buffer: Buffer, mimetype: string) {
  assertBusinessRegistrationImageMime(mimetype);
  const existing = await prisma.tenantPgOnboarding.findFirst({
    where: { tenantId },
    select: { businessCardImagePublicId: true },
  });
  const uploaded = await uploadBusinessRegistrationBuffer({
    folder: `cbiseo/pg-business-card/${tenantId}`,
    buffer,
    mimetype,
  });
  await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: {
      tenantId,
      businessCardImageUrl: uploaded.secureUrl,
      businessCardImagePublicId: uploaded.publicId,
    },
    update: {
      businessCardImageUrl: uploaded.secureUrl,
      businessCardImagePublicId: uploaded.publicId,
    },
  });
  if (existing?.businessCardImagePublicId && existing.businessCardImagePublicId !== uploaded.publicId) {
    await destroyBusinessRegistrationPublicId(existing.businessCardImagePublicId);
  }
  return { businessCardImageUrl: uploaded.secureUrl };
}

function applyApplicationExtras(
  input: OnboardingInput,
  existing: {
    businessKind?: string | null;
    consentTermsAt?: Date | null;
    consentPrivacyAt?: Date | null;
    consentThirdPartyAt?: Date | null;
    consentIllegalUseAt?: Date | null;
    consentMarketingAt?: Date | null;
  } | null,
  now: Date,
) {
  const data: {
    businessKind?: string | null;
    consentTermsAt?: Date | null;
    consentPrivacyAt?: Date | null;
    consentThirdPartyAt?: Date | null;
    consentIllegalUseAt?: Date | null;
    consentMarketingAt?: Date | null;
  } = {};
  if (input.businessKind !== undefined) {
    const kind = readBusinessKind(input);
    if (input.businessKind && !kind) {
      throw new Error('사업자가 없는 개인은 신청할 수 없습니다. 법인 또는 개인사업자를 선택해 주세요.');
    }
    data.businessKind = kind;
  }
  if (input.consentTerms !== undefined) data.consentTermsAt = consentStamp(input.consentTerms, existing?.consentTermsAt, now);
  if (input.consentPrivacy !== undefined) data.consentPrivacyAt = consentStamp(input.consentPrivacy, existing?.consentPrivacyAt, now);
  if (input.consentThirdParty !== undefined) data.consentThirdPartyAt = consentStamp(input.consentThirdParty, existing?.consentThirdPartyAt, now);
  if (input.consentIllegalUse !== undefined) data.consentIllegalUseAt = consentStamp(input.consentIllegalUse, existing?.consentIllegalUseAt, now);
  if (input.consentMarketing !== undefined) data.consentMarketingAt = consentStamp(input.consentMarketing, existing?.consentMarketingAt, now);
  return data;
}

export async function listOnboardingsForPartner() {
  const rows = await prisma.tenantPgOnboarding.findMany({
    where: { status: { not: 'DRAFT' } },
    orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: { tenant: { select: { name: true } } },
  });
  const tenantIds = rows.map((row) => row.tenantId);
  if (tenantIds.length === 0) return [];
  const [credentials, images] = await Promise.all([
    prisma.tenantPgCredential.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, rail: true, mid: true, oid: true, apiKeyLast4: true, isActive: true },
    }),
    prisma.tenantSignupBusiness.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, businessRegistrationImageUrl: true },
    }),
  ]);
  const credentialByTenant = new Map<string, (typeof credentials)[number][]>();
  for (const row of credentials) {
    const list = credentialByTenant.get(row.tenantId) ?? [];
    list.push(row);
    credentialByTenant.set(row.tenantId, list);
  }
  const imageByTenant = new Map(images.map((row) => [row.tenantId, row.businessRegistrationImageUrl]));
  return rows.map((row) => {
    const slots = credentialByTenant.get(row.tenantId) ?? [];
    const credential = slots.find((slot) => slot.rail === 'KEYIN' && slot.isActive) ?? slots.find((slot) => slot.isActive) ?? null;
    return {
      id: row.id,
      tenantName: row.tenant.name,
      businessName: row.businessName,
      bizNumber: row.bizNumber,
      representativeName: row.representativeName,
      representativeBirth: row.representativeBirth,
      addressLine: row.addressLine,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      bankName: row.bankName,
      bankAccount: row.bankAccount,
      accountHolder: row.accountHolder,
      websiteUrl: row.websiteUrl,
      note: row.note,
      businessKind: row.businessKind,
      businessRegistrationImageUrl: imageByTenant.get(row.tenantId)?.trim() || null,
      businessCardImageUrl: row.businessCardImageUrl,
      consentTermsAt: row.consentTermsAt?.toISOString() ?? null,
      consentPrivacyAt: row.consentPrivacyAt?.toISOString() ?? null,
      consentThirdPartyAt: row.consentThirdPartyAt?.toISOString() ?? null,
      consentIllegalUseAt: row.consentIllegalUseAt?.toISOString() ?? null,
      consentMarketingAt: row.consentMarketingAt?.toISOString() ?? null,
      status: row.status,
      contractSignedAt: row.contractSignedAt?.toISOString() ?? null,
      contractMailedAt: row.contractMailedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      connected: Boolean(credential?.isActive),
      mid: credential?.mid ?? null,
      oid: credential?.oid ?? null,
      apiKeyLast4: credential?.apiKeyLast4 ?? null,
    };
  });
}

export async function markTenantContractMailed(tenantId: string) {
  const row = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId } });
  if (!row?.contractSignedAt) throw new Error('전자계약을 작성한 뒤에 우편 발송을 표시합니다.');
  if (row.contractMailedAt) return serializeOnboarding(row);
  const saved = await prisma.tenantPgOnboarding.update({
    where: { tenantId },
    data: { contractMailedAt: new Date() },
  });
  return serializeOnboarding(saved);
}

export async function tenantIdForSubmittedOnboarding(onboardingId: string): Promise<string | null> {
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { id: onboardingId, status: { not: 'DRAFT' } },
    select: { tenantId: true },
  });
  return row?.tenantId ?? null;
}

/** 코드 입력은 신청 승인 후, 전자계약이 들어온 뒤에만. 이미 연결된 업체는 코드 수정만 허용. */
export async function assertPartnerCodeEntry(onboardingId: string): Promise<{ tenantId: string } | { error: string }> {
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { id: onboardingId, status: { not: 'DRAFT' } },
    select: { tenantId: true, status: true, contractSignedAt: true },
  });
  if (!row) return { error: 'PG 신청을 찾을 수 없습니다.' };
  const credential = await prisma.tenantPgCredential.findFirst({
    where: { tenantId: row.tenantId, isActive: true },
    select: { id: true },
  });
  if (credential) return { tenantId: row.tenantId };
  if (row.status !== 'APPROVED') return { error: '신청을 승인한 뒤에 코드를 입력합니다.' };
  if (!row.contractSignedAt) return { error: '전자계약이 들어온 뒤에 코드를 입력합니다.' };
  return { tenantId: row.tenantId };
}

export async function decidePartnerOnboarding(onboardingId: string, decision: 'APPROVED' | 'REJECTED') {
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { id: onboardingId, status: { not: 'DRAFT' } },
  });
  if (!row) return null;
  const credential = await prisma.tenantPgCredential.findFirst({
    where: { tenantId: row.tenantId, isActive: true },
    select: { id: true },
  });
  if (credential) throw new Error('이미 코드가 연결된 업체는 승인이나 거절을 바꾸지 않습니다.');
  if (row.contractSignedAt && decision === 'REJECTED') {
    throw new Error('전자계약이 들어온 신청은 거절할 수 없습니다.');
  }
  const open = row.status === 'SUBMITTED' || row.status === 'FORWARDED_TO_PG';
  const undoReject = row.status === 'REJECTED' && decision === 'APPROVED';
  const undoApprove = row.status === 'APPROVED' && decision === 'REJECTED' && !row.contractSignedAt;
  if (!open && !undoReject && !undoApprove) {
    if (row.status === decision) return { id: row.id, status: row.status };
    throw new Error('지금 승인하거나 거절할 수 없습니다.');
  }
  const updated = await prisma.tenantPgOnboarding.update({
    where: { id: row.id },
    data: { status: decision, decidedAt: new Date() },
  });
  return { id: updated.id, status: updated.status };
}

export async function getOnboardingByReviewToken(token: string) {
  const reviewToken = token.trim();
  if (!reviewToken) return null;
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { reviewToken },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!row || row.status === 'DRAFT') return null;
  const credential = await prisma.tenantPgCredential.findFirst({
    where: { tenantId: row.tenantId },
    select: { mid: true, oid: true, apiKeyLast4: true, isActive: true },
  });
  return {
    tenantName: row.tenant.name,
    businessName: row.businessName,
    bizNumber: row.bizNumber,
    representativeName: row.representativeName,
    representativeBirth: row.representativeBirth,
    addressLine: row.addressLine,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    bankName: row.bankName,
    bankAccount: row.bankAccount,
    accountHolder: row.accountHolder,
    websiteUrl: row.websiteUrl,
    note: row.note,
    businessKind: row.businessKind,
    businessRegistrationImageUrl: await registrationImageUrl(row.tenantId),
    businessCardImageUrl: row.businessCardImageUrl,
    consentTermsAt: row.consentTermsAt?.toISOString() ?? null,
    consentPrivacyAt: row.consentPrivacyAt?.toISOString() ?? null,
    consentThirdPartyAt: row.consentThirdPartyAt?.toISOString() ?? null,
    consentIllegalUseAt: row.consentIllegalUseAt?.toISOString() ?? null,
    id: row.id,
    status: row.status,
    contractSignedAt: row.contractSignedAt?.toISOString() ?? null,
    connected: Boolean(credential?.isActive),
    mid: credential?.mid ?? null,
    oid: credential?.oid ?? null,
    apiKeyLast4: credential?.apiKeyLast4 ?? null,
    tenantId: row.tenantId,
  };
}

export async function listOnboardingsForPlatform(query: {
  status?: TenantPgOnboardingStatus;
  limit: number;
  offset: number;
}) {
  const where: Prisma.TenantPgOnboardingWhereInput = {};
  if (query.status) where.status = query.status;
  const [items, total] = await Promise.all([
    prisma.tenantPgOnboarding.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.tenantPgOnboarding.count({ where }),
  ]);
  return {
    total,
    items: items.map((row) => ({
      ...serializeOnboarding(row),
      tenant: row.tenant,
    })),
  };
}

export async function updateOnboardingByPlatform(
  tenantId: string,
  input: { status: TenantPgOnboardingStatus; platformMemo?: string | null },
) {
  const existing = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId } });
  if (!existing) return null;
  const now = new Date();
  const row = await prisma.tenantPgOnboarding.update({
    where: { tenantId },
    data: {
      status: input.status,
      platformMemo: input.platformMemo ?? existing.platformMemo,
      forwardedAt: input.status === 'FORWARDED_TO_PG' ? now : existing.forwardedAt,
      decidedAt: input.status === 'APPROVED' || input.status === 'REJECTED' ? now : existing.decidedAt,
    },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  });
  return { ...serializeOnboarding(row), tenant: row.tenant };
}

function pickOnboarding(input: OnboardingInput): Record<(typeof ONBOARDING_FIELDS)[number], string | null | undefined> {
  const data: Record<string, string | null> = {};
  for (const key of ONBOARDING_FIELDS) {
    if (input[key] !== undefined) {
      const v = input[key];
      data[key] = v == null || v === '' ? null : String(v).trim();
    }
  }
  return data;
}
