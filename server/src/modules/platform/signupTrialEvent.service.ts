import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { addDaysUtc } from '../billing/tenantBilling.dates.js';
import { normalizePlanId, type TenantPlanId } from '../tenants/tenantFeatureCatalog.js';
import { TENANT_SIGNUP_GRACE_DAYS } from './tenantSignup.constants.js';

type Db = Prisma.TransactionClient | typeof prisma;

export type SignupTrialSource = 'self_serve' | 'platform_provision' | 'plan_upgrade';

export type PlatformSignupTrialEventRow = {
  id: string;
  name: string;
  isActive: boolean;
  trialDays: number;
  startsAt: string | null;
  endsAt: string | null;
  applySelfServe: boolean;
  applyPlatformProvision: boolean;
  includeCoinGrace: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  isCurrentlyEffective: boolean;
};

export type SignupTrialApplication = {
  applyTrial: boolean;
  trialDays: number | null;
  eventId: string | null;
  eventName: string | null;
  includeCoinGrace: boolean;
  status: 'ACTIVE' | 'TRIAL';
  prepaidConfirmedAt: Date | null;
  trialEndsAt: Date | null;
  coinGraceEndsAt: string | null;
  signupGraceDays: number | null;
  paidTrialDays: number | null;
};

function mapEventRow(
  row: {
    id: string;
    name: string;
    isActive: boolean;
    trialDays: number;
    startsAt: Date | null;
    endsAt: Date | null;
    applySelfServe: boolean;
    applyPlatformProvision: boolean;
    includeCoinGrace: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
  },
  now: Date,
): PlatformSignupTrialEventRow {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    trialDays: row.trialDays,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    applySelfServe: row.applySelfServe,
    applyPlatformProvision: row.applyPlatformProvision,
    includeCoinGrace: row.includeCoinGrace,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isCurrentlyEffective: isEventEffective(row, now),
  };
}

function isEventEffective(
  row: {
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  now: Date,
): boolean {
  if (!row.isActive) return false;
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) return false;
  if (row.endsAt && row.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

function eventAppliesToSource(
  row: { applySelfServe: boolean; applyPlatformProvision: boolean },
  source: SignupTrialSource,
): boolean {
  if (source === 'platform_provision') return row.applyPlatformProvision;
  // self_serve · plan_upgrade(유료 전환)는 셀프가입 플래그 사용
  return row.applySelfServe;
}

/** 지금 유효한 이벤트 1건 (priority desc, createdAt desc) */
export async function getActiveSignupTrialEvent(
  db: Db = prisma,
  now: Date = new Date(),
) {
  const rows = await db.platformSignupTrialEvent.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  });
  return rows.find((r) => isEventEffective(r, now)) ?? null;
}

/**
 * Free = 체험 없음.
 * 유료 = 활성 이벤트+경로 매칭 시에만 자동 체험. 아니면 체험 전(유료 대기).
 */
export async function resolveSignupTrialApplication(
  input: { plan: string; source: SignupTrialSource; now?: Date },
  db: Db = prisma,
): Promise<SignupTrialApplication> {
  const now = input.now ?? new Date();
  const plan = normalizePlanId(input.plan);

  if (plan === 'free') {
    return {
      applyTrial: false,
      trialDays: null,
      eventId: null,
      eventName: null,
      includeCoinGrace: false,
      status: 'ACTIVE',
      prepaidConfirmedAt: null,
      trialEndsAt: null,
      coinGraceEndsAt: null,
      signupGraceDays: null,
      paidTrialDays: null,
    };
  }

  const event = await getActiveSignupTrialEvent(db, now);
  if (!event || !eventAppliesToSource(event, input.source)) {
    return {
      applyTrial: false,
      trialDays: null,
      eventId: null,
      eventName: null,
      includeCoinGrace: false,
      status: 'TRIAL',
      prepaidConfirmedAt: null,
      trialEndsAt: null,
      coinGraceEndsAt: null,
      signupGraceDays: null,
      paidTrialDays: null,
    };
  }

  const trialDays = Math.max(1, Math.min(3650, event.trialDays || TENANT_SIGNUP_GRACE_DAYS));
  const trialEndsAt = addDaysUtc(now, trialDays);
  const includeCoinGrace = event.includeCoinGrace !== false;

  return {
    applyTrial: true,
    trialDays,
    eventId: event.id,
    eventName: event.name,
    includeCoinGrace,
    status: 'TRIAL',
    prepaidConfirmedAt: now,
    trialEndsAt,
    coinGraceEndsAt: includeCoinGrace ? trialEndsAt.toISOString() : null,
    signupGraceDays: trialDays,
    paidTrialDays: trialDays,
  };
}

export function buildSignupConfigPatch(
  prevSignup: Record<string, unknown>,
  app: SignupTrialApplication,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...prevSignup,
    ...extra,
    signupGraceDays: app.signupGraceDays,
    coinGraceEndsAt: app.coinGraceEndsAt,
    paidTrialDays: app.paidTrialDays,
    trialEventId: app.eventId,
    trialEventName: app.eventName,
  };
}

/** 수동 「체험 시작」용 일수 — 활성 이벤트 있으면 그 값, 없으면 기본 60 */
export async function resolveManualTrialDays(db: Db = prisma, now: Date = new Date()): Promise<{
  trialDays: number;
  eventId: string | null;
  eventName: string | null;
  includeCoinGrace: boolean;
}> {
  const event = await getActiveSignupTrialEvent(db, now);
  if (!event) {
    return {
      trialDays: TENANT_SIGNUP_GRACE_DAYS,
      eventId: null,
      eventName: null,
      includeCoinGrace: true,
    };
  }
  return {
    trialDays: Math.max(1, Math.min(3650, event.trialDays || TENANT_SIGNUP_GRACE_DAYS)),
    eventId: event.id,
    eventName: event.name,
    includeCoinGrace: event.includeCoinGrace !== false,
  };
}

export async function listSignupTrialEvents(): Promise<PlatformSignupTrialEventRow[]> {
  const now = new Date();
  const rows = await prisma.platformSignupTrialEvent.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map((r) => mapEventRow(r, now));
}

export async function getSignupTrialEvent(id: string): Promise<PlatformSignupTrialEventRow | null> {
  const row = await prisma.platformSignupTrialEvent.findUnique({ where: { id } });
  if (!row) return null;
  return mapEventRow(row, new Date());
}

export type UpsertSignupTrialEventInput = {
  name: string;
  isActive?: boolean;
  trialDays?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  applySelfServe?: boolean;
  applyPlatformProvision?: boolean;
  includeCoinGrace?: boolean;
  priority?: number;
  createdByPlatformUserId?: string | null;
};

function parseOptionalDate(raw: string | null | undefined): Date | null {
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('날짜 형식이 올바르지 않습니다.');
  return d;
}

function normalizeUpsert(input: UpsertSignupTrialEventInput) {
  const name = String(input.name ?? '').trim().slice(0, 128);
  if (!name) throw new Error('이벤트명을 입력해 주세요.');
  const trialDays = Math.max(1, Math.min(3650, Number(input.trialDays ?? TENANT_SIGNUP_GRACE_DAYS) || TENANT_SIGNUP_GRACE_DAYS));
  const startsAt = parseOptionalDate(input.startsAt);
  const endsAt = parseOptionalDate(input.endsAt);
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error('종료 일시는 시작 일시보다 이후여야 합니다.');
  }
  return {
    name,
    isActive: input.isActive !== false,
    trialDays,
    startsAt,
    endsAt,
    applySelfServe: input.applySelfServe !== false,
    applyPlatformProvision: input.applyPlatformProvision !== false,
    includeCoinGrace: input.includeCoinGrace !== false,
    priority: Number.isFinite(Number(input.priority)) ? Math.floor(Number(input.priority)) : 0,
  };
}

export async function createSignupTrialEvent(
  input: UpsertSignupTrialEventInput,
): Promise<PlatformSignupTrialEventRow> {
  const data = normalizeUpsert(input);
  const row = await prisma.platformSignupTrialEvent.create({
    data: {
      ...data,
      createdByPlatformUserId: input.createdByPlatformUserId?.trim() || null,
    },
  });
  return mapEventRow(row, new Date());
}

export async function updateSignupTrialEvent(
  id: string,
  input: Partial<UpsertSignupTrialEventInput> & { name?: string },
): Promise<PlatformSignupTrialEventRow> {
  const existing = await prisma.platformSignupTrialEvent.findUnique({ where: { id } });
  if (!existing) throw new Error('이벤트를 찾을 수 없습니다.');
  const data = normalizeUpsert({
    name: input.name ?? existing.name,
    isActive: input.isActive ?? existing.isActive,
    trialDays: input.trialDays ?? existing.trialDays,
    startsAt:
      input.startsAt !== undefined
        ? input.startsAt
        : existing.startsAt?.toISOString() ?? null,
    endsAt:
      input.endsAt !== undefined ? input.endsAt : existing.endsAt?.toISOString() ?? null,
    applySelfServe: input.applySelfServe ?? existing.applySelfServe,
    applyPlatformProvision: input.applyPlatformProvision ?? existing.applyPlatformProvision,
    includeCoinGrace: input.includeCoinGrace ?? existing.includeCoinGrace,
    priority: input.priority ?? existing.priority,
  });
  const row = await prisma.platformSignupTrialEvent.update({
    where: { id },
    data,
  });
  return mapEventRow(row, new Date());
}

export async function deleteSignupTrialEvent(id: string): Promise<void> {
  const existing = await prisma.platformSignupTrialEvent.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new Error('이벤트를 찾을 수 없습니다.');
  await prisma.platformSignupTrialEvent.delete({ where: { id } });
}

export type { TenantPlanId };
