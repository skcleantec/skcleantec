import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  areaComplexKey,
  normalizeAreaRuleSpec,
  resolveTelecrmArea,
  type TelecrmAreaResolveResult,
  type TelecrmAreaRuleSpec,
} from './telecrmAreaResolve.js';
import { lookupQuickQuoteAreas, searchQuickQuoteAddress } from './telecrmQuickQuoteAddress.service.js';

function brandWhere(operatingCompanyId: string | null): { OR?: { operatingCompanyId: string | null }[] } {
  if (!operatingCompanyId) return {};
  return { OR: [{ operatingCompanyId: null }, { operatingCompanyId }] };
}

export async function listTelecrmAreaRules(tenantId: string, operatingCompanyId: string | null) {
  const [items, caseCount] = await Promise.all([
    prisma.telecrmAreaRule.findMany({
      where: { tenantId, ...brandWhere(operatingCompanyId) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.telecrmAreaCase.count({ where: { tenantId, ...brandWhere(operatingCompanyId) } }),
  ]);
  return {
    caseCount,
    items: items.map((row) => ({
      id: row.id,
      spec: row.spec as TelecrmAreaRuleSpec,
      summary: row.summary,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function createTelecrmAreaRule(
  tenantId: string,
  operatingCompanyId: string | null,
  spec: TelecrmAreaRuleSpec,
) {
  const last = await prisma.telecrmAreaRule.findFirst({
    where: { tenantId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return prisma.telecrmAreaRule.create({
    data: {
      tenantId,
      operatingCompanyId,
      kind: spec.kind,
      spec: spec as unknown as Prisma.InputJsonValue,
      summary: spec.summary.slice(0, 200),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateTelecrmAreaRule(
  tenantId: string,
  id: string,
  patch: { isActive?: boolean },
) {
  const row = await prisma.telecrmAreaRule.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!row) return null;
  return prisma.telecrmAreaRule.update({
    where: { id: row.id },
    data: { isActive: patch.isActive },
  });
}

export async function deleteTelecrmAreaRule(tenantId: string, id: string) {
  const result = await prisma.telecrmAreaRule.deleteMany({ where: { id, tenantId } });
  return result.count > 0;
}

async function ledgerFor(tenantId: string, address: string) {
  const page = await searchQuickQuoteAddress(tenantId, address);
  const hit = page.items[0];
  if (!hit) return null;
  const areas = await lookupQuickQuoteAreas(
    tenantId,
    {
      admCd: hit.admCd,
      rnMgtSn: hit.rnMgtSn,
      udrtYn: hit.udrtYn,
      buldMnnm: hit.buldMnnm,
      buldSlno: hit.buldSlno,
      lnbrMnnm: hit.lnbrMnnm,
      lnbrSlno: hit.lnbrSlno,
      mtYn: hit.mtYn,
    },
    undefined,
    undefined,
    hit.relJibun,
    address,
  );
  if (areas.kind === 'groups') {
    return areas.groups.map((group) => ({ exclusiveSqm: group.exclusiveSqm, supplyPyeong: group.supplyPyeong }));
  }
  if (areas.kind === 'unit') {
    return [{ exclusiveSqm: areas.exclusiveSqm, supplyPyeong: areas.supplyPyeong }];
  }
  return null;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export async function resolveTelecrmAreaForTenant(input: {
  tenantId: string;
  operatingCompanyId: string | null;
  raw: string;
  buildingType?: string | null;
  propertyType?: string | null;
  address?: string | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  isOneRoom?: boolean | null;
  roomText?: string | null;
}): Promise<TelecrmAreaResolveResult> {
  const address = (input.address ?? '').trim();
  const [rules, cases, ledger] = await Promise.all([
    prisma.telecrmAreaRule.findMany({
      where: { tenantId: input.tenantId, isActive: true, ...brandWhere(input.operatingCompanyId) },
      orderBy: { sortOrder: 'asc' },
    }),
    address
      ? prisma.telecrmAreaCase.findMany({
          where: { tenantId: input.tenantId, ...brandWhere(input.operatingCompanyId) },
          orderBy: { createdAt: 'desc' },
          take: 40,
        })
      : Promise.resolve([]),
    address.length >= 4 ? withTimeout(ledgerFor(input.tenantId, address), 6000) : Promise.resolve(null),
  ]);
  return resolveTelecrmArea({
    raw: input.raw,
    buildingType: input.buildingType,
    propertyType: input.propertyType,
    address,
    roomCount: input.roomCount,
    bathroomCount: input.bathroomCount,
    isOneRoom: input.isOneRoom,
    roomText: input.roomText,
    ledger,
    rules: rules.map((row) => normalizeAreaRuleSpec(row.spec)).filter((row): row is TelecrmAreaRuleSpec => row != null),
    cases: cases.map((row) => ({
      addressKey: row.addressKey,
      customerValue: row.customerValue,
      customerMark: row.customerMark,
      supplyPyeong: row.supplyPyeong,
    })),
  });
}

export async function recordTelecrmAreaCase(input: {
  tenantId: string;
  operatingCompanyId: string | null;
  address: string;
  customerValue: number;
  customerMark: string | null;
  supplyPyeong: number;
}) {
  const addressKey = areaComplexKey(input.address);
  if (!addressKey || !(input.customerValue > 0) || !(input.supplyPyeong > 0)) return { saved: false as const };
  await prisma.telecrmAreaCase.create({
    data: {
      tenantId: input.tenantId,
      operatingCompanyId: input.operatingCompanyId,
      addressKey: addressKey.slice(0, 80),
      customerValue: input.customerValue,
      customerMark: input.customerMark?.slice(0, 16) || null,
      supplyPyeong: input.supplyPyeong,
    },
  });
  return { saved: true as const };
}
