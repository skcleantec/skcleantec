import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { embedResponseCardTexts, responseCardEmbedText } from './telecrmResponseCards.embedding.js';
import { parseEmbedding, scoreResponseCard } from './telecrmResponseCards.score.js';

const CARD_STATUSES = ['draft', 'approved', 'archived'] as const;
export type ResponseCardStatus = (typeof CARD_STATUSES)[number];

const CACHE_MS = 10 * 60 * 1000;

type CachedCard = {
  id: string;
  operatingCompanyId: string | null;
  code: string;
  category: string;
  title: string;
  triggers: string[];
  intent: string;
  responses: [string, string][];
  avoid: string[];
  rule: string;
  sources: string[];
  wonInCall: boolean;
  embedding: number[] | null;
};

const approvedCache = new Map<string, { expires: number; cards: CachedCard[] }>();

export function invalidateResponseCardCache(tenantId: string): void {
  approvedCache.delete(tenantId);
}

export function isResponseCardStatus(value: string): value is ResponseCardStatus {
  return (CARD_STATUSES as readonly string[]).includes(value);
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asResponses(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, string][] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string') continue;
    const style = row[0].trim();
    const text = row[1].trim();
    if (style && text) out.push([style, text]);
  }
  return out;
}

export type ImportedResponseCard = {
  code: string;
  category: string;
  title: string;
  triggers: string[];
  intent: string;
  responses: [string, string][];
  avoid: string[];
  rule: string;
  sources: string[];
  wonInCall: boolean;
};

export function parseImportedResponseCard(raw: unknown): ImportedResponseCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const code = typeof row.id === 'string' ? row.id.trim() : typeof row.code === 'string' ? row.code.trim() : '';
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!/^[A-Za-z0-9_-]{2,16}$/.test(code) || !title) return null;
  const category = (typeof row.cat === 'string' ? row.cat : typeof row.category === 'string' ? row.category : '')
    .trim()
    .slice(0, 40);
  return {
    code,
    category: category || '기타',
    title: title.slice(0, 200),
    triggers: asStringArray(row.say ?? row.triggers).slice(0, 20),
    intent: (typeof row.mind === 'string' ? row.mind : typeof row.intent === 'string' ? row.intent : '')
      .trim()
      .slice(0, 2000),
    responses: asResponses(row.res ?? row.responses).slice(0, 8),
    avoid: asStringArray(row.avoid).slice(0, 12),
    rule: (typeof row.rule === 'string' ? row.rule : '').trim().slice(0, 2000),
    sources: asStringArray(row.src ?? row.sources).slice(0, 12),
    wonInCall: row.win === true || row.wonInCall === true,
  };
}

function toCached(row: {
  id: string;
  operatingCompanyId: string | null;
  code: string;
  category: string;
  title: string;
  triggers: Prisma.JsonValue;
  intent: string;
  responses: Prisma.JsonValue;
  avoid: Prisma.JsonValue;
  rule: string;
  sources: Prisma.JsonValue;
  wonInCall: boolean;
  embedding: Prisma.JsonValue | null;
}): CachedCard {
  return {
    id: row.id,
    operatingCompanyId: row.operatingCompanyId,
    code: row.code,
    category: row.category,
    title: row.title,
    triggers: asStringArray(row.triggers),
    intent: row.intent,
    responses: asResponses(row.responses),
    avoid: asStringArray(row.avoid),
    rule: row.rule,
    sources: asStringArray(row.sources),
    wonInCall: row.wonInCall,
    embedding: parseEmbedding(row.embedding),
  };
}

export function toResponseCardDto(card: CachedCard & { status?: string; useCount?: number; upCount?: number; downCount?: number }) {
  return {
    id: card.id,
    code: card.code,
    category: card.category,
    title: card.title,
    triggers: card.triggers,
    intent: card.intent,
    responses: card.responses,
    avoid: card.avoid,
    rule: card.rule,
    sources: card.sources,
    wonInCall: card.wonInCall,
    operatingCompanyId: card.operatingCompanyId,
    status: card.status,
    useCount: card.useCount,
    upCount: card.upCount,
    downCount: card.downCount,
  };
}

async function loadApprovedCards(tenantId: string): Promise<CachedCard[]> {
  const hit = approvedCache.get(tenantId);
  if (hit && hit.expires > Date.now()) return hit.cards;
  const rows = await prisma.telecrmResponseCard.findMany({
    where: { tenantId, status: 'approved' },
    select: {
      id: true,
      operatingCompanyId: true,
      code: true,
      category: true,
      title: true,
      triggers: true,
      intent: true,
      responses: true,
      avoid: true,
      rule: true,
      sources: true,
      wonInCall: true,
      embedding: true,
    },
  });
  const cards = rows.map(toCached);
  approvedCache.set(tenantId, { expires: Date.now() + CACHE_MS, cards });
  return cards;
}

export async function importResponseCards(params: {
  tenantId: string;
  userId: string;
  operatingCompanyId: string | null;
  items: ImportedResponseCard[];
}): Promise<{ created: number; updated: number; embedded: number }> {
  const vectors = await embedResponseCardTexts(params.items.map((item) => responseCardEmbedText(item)));
  let created = 0;
  let updated = 0;
  let embedded = 0;
  for (let i = 0; i < params.items.length; i += 1) {
    const item = params.items[i]!;
    const embedding = vectors?.[i] ?? null;
    if (embedding) embedded += 1;
    const existing = await prisma.telecrmResponseCard.findFirst({
      where: { tenantId: params.tenantId, code: item.code },
      select: { id: true },
    });
    const content = {
      category: item.category,
      title: item.title,
      triggers: item.triggers,
      intent: item.intent,
      responses: item.responses,
      avoid: item.avoid,
      rule: item.rule,
      sources: item.sources,
      wonInCall: item.wonInCall,
      ...(embedding ? { embedding } : {}),
      ...(params.operatingCompanyId ? { operatingCompanyId: params.operatingCompanyId } : {}),
    };
    if (existing) {
      await prisma.telecrmResponseCard.updateMany({
        where: { id: existing.id, tenantId: params.tenantId },
        data: content,
      });
      updated += 1;
    } else {
      await prisma.telecrmResponseCard.create({
        data: {
          tenantId: params.tenantId,
          code: item.code,
          status: 'draft',
          createdById: params.userId,
          ...content,
        },
      });
      created += 1;
    }
  }
  invalidateResponseCardCache(params.tenantId);
  return { created, updated, embedded };
}

export async function searchResponseCards(params: {
  tenantId: string;
  userId: string;
  operatingCompanyId: string;
  q: string;
}): Promise<{ items: Array<ReturnType<typeof toResponseCardDto> & { score: number }> }> {
  const cards = await loadApprovedCards(params.tenantId);
  const visible = cards.filter(
    (card) => !card.operatingCompanyId || card.operatingCompanyId === params.operatingCompanyId,
  );
  const queryVectors = await embedResponseCardTexts([params.q.slice(0, 500)]);
  const queryEmbedding = queryVectors?.[0] ?? null;
  const ranked = visible
    .map((card) => ({
      card,
      score: scoreResponseCard(
        {
          title: card.title,
          triggers: card.triggers,
          intent: card.intent,
          responseTexts: card.responses.map((row) => row[1]),
          avoid: card.avoid,
          rule: card.rule,
          wonInCall: card.wonInCall,
          embedding: card.embedding,
        },
        params.q,
        queryEmbedding,
      ),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  await prisma.telecrmResponseSearchLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      q: params.q.slice(0, 300),
      resultCount: ranked.length,
    },
  });

  return {
    items: ranked.map((row) => ({
      ...toResponseCardDto(row.card),
      status: 'approved' as const,
      score: Math.round(row.score * 100) / 100,
    })),
  };
}

export async function listResponseCards(params: {
  tenantId: string;
  status: ResponseCardStatus;
  operatingCompanyId?: string | null;
}) {
  const rows = await prisma.telecrmResponseCard.findMany({
    where: {
      tenantId: params.tenantId,
      status: params.status,
      ...(params.operatingCompanyId
        ? {
            OR: [{ operatingCompanyId: null }, { operatingCompanyId: params.operatingCompanyId }],
          }
        : {}),
    },
    orderBy: [{ code: 'asc' }],
    select: {
      id: true,
      operatingCompanyId: true,
      code: true,
      category: true,
      title: true,
      triggers: true,
      intent: true,
      responses: true,
      avoid: true,
      rule: true,
      sources: true,
      wonInCall: true,
      status: true,
      useCount: true,
      upCount: true,
      downCount: true,
      approvedAt: true,
      updatedAt: true,
    },
  });
  return {
    items: rows.map((row) => ({
      ...toResponseCardDto({ ...toCached({ ...row, embedding: null }), status: row.status }),
      status: row.status,
      useCount: row.useCount,
      upCount: row.upCount,
      downCount: row.downCount,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export type ResponseCardPatch = {
  category?: string;
  title?: string;
  triggers?: string[];
  intent?: string;
  responses?: [string, string][];
  avoid?: string[];
  rule?: string;
  sources?: string[];
  wonInCall?: boolean;
  status?: ResponseCardStatus;
  operatingCompanyId?: string | null;
};

export async function patchResponseCard(params: {
  tenantId: string;
  userId: string;
  id: string;
  patch: ResponseCardPatch;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.telecrmResponseCard.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
    select: { id: true, title: true, triggers: true, intent: true, status: true },
  });
  if (!existing) return { ok: false, status: 404, error: '대응 카드를 찾을 수 없습니다.' };

  const data: Prisma.TelecrmResponseCardUncheckedUpdateManyInput = {};
  if (params.patch.category != null) data.category = params.patch.category.slice(0, 40);
  if (params.patch.title != null) data.title = params.patch.title.slice(0, 200);
  if (params.patch.triggers) data.triggers = params.patch.triggers;
  if (params.patch.intent != null) data.intent = params.patch.intent.slice(0, 2000);
  if (params.patch.responses) data.responses = params.patch.responses;
  if (params.patch.avoid) data.avoid = params.patch.avoid;
  if (params.patch.rule != null) data.rule = params.patch.rule.slice(0, 2000);
  if (params.patch.sources) data.sources = params.patch.sources;
  if (params.patch.wonInCall != null) data.wonInCall = params.patch.wonInCall;
  if (params.patch.operatingCompanyId !== undefined) data.operatingCompanyId = params.patch.operatingCompanyId;
  if (params.patch.status) {
    data.status = params.patch.status;
    if (params.patch.status === 'approved') {
      data.approvedById = params.userId;
      data.approvedAt = new Date();
    }
  }

  const embedSourceChanged =
    params.patch.title != null || params.patch.triggers != null || params.patch.intent != null;
  if (embedSourceChanged) {
    const title = params.patch.title ?? existing.title;
    const triggers = params.patch.triggers ?? asStringArray(existing.triggers);
    const intent = params.patch.intent ?? existing.intent;
    const vectors = await embedResponseCardTexts([responseCardEmbedText({ title, triggers, intent })]);
    if (vectors?.[0]) data.embedding = vectors[0];
  }

  await prisma.telecrmResponseCard.updateMany({
    where: { id: existing.id, tenantId: params.tenantId },
    data,
  });
  invalidateResponseCardCache(params.tenantId);
  return { ok: true };
}

export async function feedbackResponseCard(params: {
  tenantId: string;
  id: string;
  action: 'copy' | 'up' | 'down';
  inquiryId?: string | null;
}): Promise<{ ok: true; useCount: number; upCount: number; downCount: number } | { ok: false; status: number; error: string }> {
  if (params.inquiryId) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: params.inquiryId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!inquiry) return { ok: false, status: 404, error: '접수를 찾을 수 없습니다.' };
  }
  const data =
    params.action === 'copy'
      ? { useCount: { increment: 1 } }
      : params.action === 'up'
        ? { upCount: { increment: 1 } }
        : { downCount: { increment: 1 } };
  const updated = await prisma.telecrmResponseCard.updateMany({
    where: { id: params.id, tenantId: params.tenantId, status: 'approved' },
    data,
  });
  if (updated.count !== 1) return { ok: false, status: 404, error: '승인된 대응 카드를 찾을 수 없습니다.' };
  const row = await prisma.telecrmResponseCard.findFirst({
    where: { id: params.id, tenantId: params.tenantId },
    select: { useCount: true, upCount: true, downCount: true },
  });
  return {
    ok: true,
    useCount: row?.useCount ?? 0,
    upCount: row?.upCount ?? 0,
    downCount: row?.downCount ?? 0,
  };
}

export async function listResponseSearchGaps(tenantId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.telecrmResponseSearchLog.groupBy({
    by: ['q'],
    where: { tenantId, resultCount: 0, createdAt: { gte: since } },
    _count: { q: true },
    orderBy: { _count: { q: 'desc' } },
    take: 20,
  });
  return {
    items: rows.map((row) => ({ q: row.q, count: row._count.q })),
  };
}

export async function loadCoachCards(params: {
  tenantId: string;
  operatingCompanyId: string;
  cardIds: string[];
}): Promise<CachedCard[]> {
  if (params.cardIds.length === 0) return [];
  const rows = await prisma.telecrmResponseCard.findMany({
    where: {
      tenantId: params.tenantId,
      id: { in: params.cardIds.slice(0, 6) },
      status: 'approved',
      OR: [{ operatingCompanyId: null }, { operatingCompanyId: params.operatingCompanyId }],
    },
    select: {
      id: true,
      operatingCompanyId: true,
      code: true,
      category: true,
      title: true,
      triggers: true,
      intent: true,
      responses: true,
      avoid: true,
      rule: true,
      sources: true,
      wonInCall: true,
      embedding: true,
    },
  });
  return rows.map(toCached);
}
