import type { Prisma, TenantPgOnboardingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
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

export async function getOrPrefillOnboarding(tenantId: string) {
  const existing = await prisma.tenantPgOnboarding.findFirst({ where: { tenantId } });
  if (existing) return serializeOnboarding(existing);

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
  return serializeOnboarding(created);
}

export async function saveOnboardingDraft(tenantId: string, input: OnboardingInput) {
  const data = pickOnboarding(input);
  const row = await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
  return serializeOnboarding(row);
}

export async function submitOnboarding(tenantId: string, input: OnboardingInput) {
  const data = pickOnboarding(input);
  const now = new Date();
  const row = await prisma.tenantPgOnboarding.upsert({
    where: { tenantId },
    create: { tenantId, ...data, status: 'SUBMITTED', submittedAt: now },
    update: { ...data, status: 'SUBMITTED', submittedAt: now },
  });
  return serializeOnboarding(row);
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
