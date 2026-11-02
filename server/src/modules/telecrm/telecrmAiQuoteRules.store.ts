/** 텔레CRM AI 견적 — 말로 넣은 가격 규칙 저장·읽기 (견적 계산 때마다 DB를 치지 않게 잠깐 기억) */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { TelecrmAiQuoteRuleDto, TelecrmAiQuoteRuleSpec } from '../../lib/telecrmQuoteCrewLearning.js';

const CACHE_MS = 60 * 1000;
const cache = new Map<string, { at: number; specs: TelecrmAiQuoteRuleSpec[] }>();

export function invalidateTelecrmAiQuoteRules(tenantId: string): void {
  cache.delete(tenantId);
}

function toSpec(raw: unknown): TelecrmAiQuoteRuleSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as TelecrmAiQuoteRuleSpec;
  if (!o.action || typeof o.action.amountWon !== 'number' || !o.action.kind) return null;
  return { condition: o.condition ?? {}, action: o.action, summary: String(o.summary ?? '').trim() || '규칙' };
}

/** 켜져 있는 규칙 — 위(정렬 순서)부터 */
export async function loadActiveTelecrmAiQuoteRuleSpecs(tenantId: string): Promise<TelecrmAiQuoteRuleSpec[]> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.specs;
  try {
    const rows = await prisma.telecrmAiQuoteRule.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { spec: true, summary: true },
    });
    const specs = rows
      .map((r) => {
        const spec = toSpec(r.spec);
        return spec ? { ...spec, summary: r.summary || spec.summary } : null;
      })
      .filter((x): x is TelecrmAiQuoteRuleSpec => x != null);
    cache.set(tenantId, { at: Date.now(), specs });
    return specs;
  } catch (e) {
    // 표가 아직 없거나(배포 중) 일시 오류여도 견적은 계속 나오게
    console.error('[telecrm-ai-quote] rules load failed', e instanceof Error ? e.message : e);
    return [];
  }
}

function serialize(row: {
  id: string;
  text: string;
  spec: Prisma.JsonValue;
  summary: string;
  isActive: boolean;
  sortOrder: number;
  createdByName: string | null;
  createdAt: Date;
}): TelecrmAiQuoteRuleDto {
  const spec = toSpec(row.spec) ?? { condition: {}, action: { kind: 'add', amountWon: 0 }, summary: row.summary };
  return {
    id: row.id,
    text: row.text,
    spec,
    summary: row.summary,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTelecrmAiQuoteRules(tenantId: string): Promise<TelecrmAiQuoteRuleDto[]> {
  const rows = await prisma.telecrmAiQuoteRule.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serialize);
}

export async function createTelecrmAiQuoteRule(
  tenantId: string,
  input: { text: string; spec: TelecrmAiQuoteRuleSpec; createdById: string | null; createdByName: string | null },
): Promise<TelecrmAiQuoteRuleDto> {
  const last = await prisma.telecrmAiQuoteRule.findFirst({
    where: { tenantId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const row = await prisma.telecrmAiQuoteRule.create({
    data: {
      tenantId,
      text: input.text.trim().slice(0, 2000),
      spec: input.spec as unknown as Prisma.InputJsonValue,
      summary: input.spec.summary.trim().slice(0, 200) || '규칙',
      sortOrder: (last?.sortOrder ?? 0) + 10,
      createdById: input.createdById,
      createdByName: input.createdByName?.slice(0, 120) ?? null,
    },
  });
  invalidateTelecrmAiQuoteRules(tenantId);
  return serialize(row);
}

export async function updateTelecrmAiQuoteRule(
  tenantId: string,
  id: string,
  patch: { isActive?: boolean; sortOrder?: number },
): Promise<TelecrmAiQuoteRuleDto | null> {
  const found = await prisma.telecrmAiQuoteRule.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!found) return null;
  const row = await prisma.telecrmAiQuoteRule.update({
    where: { id },
    data: {
      ...(typeof patch.isActive === 'boolean' ? { isActive: patch.isActive } : {}),
      ...(typeof patch.sortOrder === 'number' && Number.isFinite(patch.sortOrder) ? { sortOrder: Math.round(patch.sortOrder) } : {}),
    },
  });
  invalidateTelecrmAiQuoteRules(tenantId);
  return serialize(row);
}

export async function deleteTelecrmAiQuoteRule(tenantId: string, id: string): Promise<boolean> {
  const res = await prisma.telecrmAiQuoteRule.deleteMany({ where: { id, tenantId } });
  invalidateTelecrmAiQuoteRules(tenantId);
  return res.count > 0;
}
