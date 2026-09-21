import type { Prisma, PrismaClient } from '@prisma/client';
import {
  cloneGuideSections,
  defaultGuideSectionsForPack,
  inferOrderFormIndustryPackId,
  type OrderFormGuideSection,
} from '../../lib/orderFormIndustryGuideDefaults.js';

type Db = PrismaClient | Prisma.TransactionClient;

export function parseGuideSectionsJson(raw: unknown): OrderFormGuideSection[] | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      obj = JSON.parse(t);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const sections = (obj as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return null;
  const out: OrderFormGuideSection[] = [];
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue;
    const title = String((s as { title?: unknown }).title ?? '').trim();
    const itemsRaw = (s as { items?: unknown }).items;
    const items = Array.isArray(itemsRaw)
      ? itemsRaw.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (!title && !items.length) continue;
    out.push({ title: title || '안내', items });
  }
  return out.length ? out : null;
}

export function normalizeGuideSectionsInput(raw: unknown): OrderFormGuideSection[] | null {
  if (Array.isArray(raw)) return parseGuideSectionsJson({ sections: raw });
  return parseGuideSectionsJson(raw);
}

export function guideSectionsToJson(sections: OrderFormGuideSection[]): Prisma.InputJsonValue {
  return { sections } as Prisma.InputJsonValue;
}

export function resolveStoredOrDefaultGuide(opts: {
  guideSections?: unknown;
  industryPackId?: string | null;
  isDefault?: boolean;
  title?: string | null;
}): { sections: OrderFormGuideSection[]; packId: string | null; usingDefault: boolean } {
  const packId = inferOrderFormIndustryPackId({
    industryPackId: opts.industryPackId,
    isDefault: opts.isDefault,
    title: opts.title,
  });
  const stored = parseGuideSectionsJson(opts.guideSections);
  if (stored) return { sections: stored, packId, usingDefault: false };
  return {
    sections: cloneGuideSections(defaultGuideSectionsForPack(packId)),
    packId,
    usingDefault: true,
  };
}

/** 안내가 비어 있는 양식에 업종 기본을 넣고, pack 키를 채운다 */
export async function ensureTenantOrderFormGuides(db: Db, tenantId: string): Promise<void> {
  const rows = await db.orderFormTemplate.findMany({
    where: { tenantId },
    select: { id: true, title: true, isDefault: true, industryPackId: true, guideSections: true },
  });
  for (const row of rows) {
    const resolved = resolveStoredOrDefaultGuide(row);
    const needPack = !row.industryPackId && resolved.packId;
    const needGuide = row.guideSections == null && resolved.sections.length > 0;
    if (!needPack && !needGuide) continue;
    await db.orderFormTemplate.update({
      where: { id: row.id },
      data: {
        ...(needPack && resolved.packId ? { industryPackId: resolved.packId } : {}),
        ...(needGuide ? { guideSections: guideSectionsToJson(resolved.sections) } : {}),
      },
    });
  }
}
