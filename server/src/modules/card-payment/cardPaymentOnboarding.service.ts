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

export type OnboardingInput = Partial<Record<(typeof ONBOARDING_FIELDS)[number], string | null>>;

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
  const data = pickOnboarding(input);
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
  const data = pickOnboarding(input);
  const now = new Date();
  const existing = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId }, select: { reviewToken: true } });
  const reviewToken = existing?.reviewToken ?? newReviewToken();
  const row = await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: { tenantId, ...data, status: 'SUBMITTED', submittedAt: now, reviewToken },
    update: { ...data, status: 'SUBMITTED', submittedAt: now, reviewToken },
  });
  return serializeWithRegistration(tenantId, row);
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
      select: { tenantId: true, mid: true, oid: true, apiKeyLast4: true, isActive: true },
    }),
    prisma.tenantSignupBusiness.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, businessRegistrationImageUrl: true },
    }),
  ]);
  const credentialByTenant = new Map(credentials.map((row) => [row.tenantId, row]));
  const imageByTenant = new Map(images.map((row) => [row.tenantId, row.businessRegistrationImageUrl]));
  return rows.map((row) => {
    const credential = credentialByTenant.get(row.tenantId);
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
      businessRegistrationImageUrl: imageByTenant.get(row.tenantId)?.trim() || null,
      status: row.status,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      connected: Boolean(credential?.isActive),
      mid: credential?.mid ?? null,
      oid: credential?.oid ?? null,
      apiKeyLast4: credential?.apiKeyLast4 ?? null,
    };
  });
}

export async function tenantIdForSubmittedOnboarding(onboardingId: string): Promise<string | null> {
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { id: onboardingId, status: { not: 'DRAFT' } },
    select: { tenantId: true },
  });
  return row?.tenantId ?? null;
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
    businessRegistrationImageUrl: await registrationImageUrl(row.tenantId),
    status: row.status,
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
