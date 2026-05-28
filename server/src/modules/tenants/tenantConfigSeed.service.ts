import type { Prisma, PrismaClient } from '@prisma/client';
import { DEFAULT_PROFESSIONAL_OPTIONS } from '../orderform/defaultProfessionalOptions.data.js';
import { DEFAULT_TENANT_ID } from './tenant.constants.js';

type Db = PrismaClient | Prisma.TransactionClient;

export function profOptionKey(tenantId: string, id: string) {
  return { tenantId_id: { tenantId, id } } as const;
}

export async function getOrCreateOrderFormConfig(
  db: Db,
  tenantId: string,
  opts?: { formTitle?: string },
) {
  let cfg = await db.orderFormConfig.findUnique({ where: { tenantId } });
  if (!cfg) {
    cfg = await db.orderFormConfig.create({
      data: {
        tenantId,
        ...(opts?.formTitle ? { formTitle: opts.formTitle } : {}),
      },
    });
  }
  return cfg;
}

export async function getOrCreateEstimateConfig(db: Db, tenantId: string) {
  let cfg = await db.estimateConfig.findUnique({ where: { tenantId } });
  if (!cfg) {
    cfg = await db.estimateConfig.create({
      data: { tenantId, pricePerPyeong: 15000, depositAmount: 20000 },
    });
  }
  return cfg;
}

export async function seedProfessionalDefaultsForTenant(db: Db, tenantId: string): Promise<void> {
  for (const row of DEFAULT_PROFESSIONAL_OPTIONS) {
    await db.professionalSpecialtyOption.upsert({
      where: profOptionKey(tenantId, row.id),
      update: {
        label: row.label,
        priceHint: row.priceHint,
        emoji: row.emoji,
        color: row.color,
        sortOrder: row.sortOrder,
        isActive: true,
        parentId: null,
        isGroup: false,
        priceAmount: null,
      },
      create: {
        tenantId,
        id: row.id,
        label: row.label,
        priceHint: row.priceHint,
        emoji: row.emoji,
        color: row.color,
        sortOrder: row.sortOrder,
        isActive: true,
        parentId: null,
        isGroup: false,
        priceAmount: null,
      },
    });
  }
}

/** 신규 테넌트 프로비저닝 — 발주서·견적·전문 시공 기본값 */
export async function seedTenantDefaults(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantName: string,
): Promise<void> {
  await getOrCreateOrderFormConfig(tx, tenantId, {
    formTitle: `${tenantName} 입주청소 발주서`,
  });
  await getOrCreateEstimateConfig(tx, tenantId);
  await seedProfessionalDefaultsForTenant(tx, tenantId);
}

/** 서버 기동·레거시 SK 테넌트 — 기본 전문 시공 옵션만 보강 */
export async function ensureDefaultTenantProfessionalDefaults(db: PrismaClient): Promise<void> {
  try {
    await seedProfessionalDefaultsForTenant(db, DEFAULT_TENANT_ID);
  } catch (e) {
    console.warn(
      '[startup] 전문 시공 기본 옵션 확인 스킵(DB 마이그레이션 필요 또는 스키마 불일치):',
      e instanceof Error ? e.message : e,
    );
  }
}
