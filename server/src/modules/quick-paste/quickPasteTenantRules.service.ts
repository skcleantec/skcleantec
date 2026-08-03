import type { PrismaClient } from '@prisma/client';
import type { QuickPasteOptionalFieldKey } from './quickPaste.constants.js';
import type { QuickPasteDraft } from './quickPasteParse.service.js';
import { parseKoreanWonFromMatch } from './quickPasteAmount.helpers.js';
import { normalizePreferredDateOrNull } from './quickPasteDate.helpers.js';

const PHONE_RE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;

type TenantRuleRow = {
  id: string;
  fieldKey: string;
  ruleType: string;
  pattern: string;
};

function normalizePhone(raw: string): string | null {
  const m = raw.match(PHONE_RE);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyLabelValueRule(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*([^\\n\\r]{1,120})`, 'i');
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function applyRegexRule(text: string, pattern: string): string | null {
  try {
    const re = new RegExp(pattern, 'im');
    const m = text.match(re);
    if (!m?.[1]) return null;
    return m[1].trim();
  } catch {
    return null;
  }
}

function coerceFieldValue(
  fieldKey: string,
  raw: string,
): string | number | null {
  const s = raw.trim();
  if (!s) return null;
  if (fieldKey === 'customerPhone') return normalizePhone(s) ?? normalizePhone(s.replace(/\s/g, ''));
  if (fieldKey === 'serviceBalanceAmount' || fieldKey === 'areaPyeong') {
    const n = Number(s.replace(/,/g, '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n)) return null;
    if (fieldKey === 'serviceBalanceAmount') {
      const won = parseKoreanWonFromMatch(s.replace(/[^\d,]/g, ''), s);
      if (won != null) return won;
    }
    return n;
  }
  if (fieldKey === 'roomCount' || fieldKey === 'bathroomCount' || fieldKey === 'balconyCount') {
    const n = Number(s.replace(/\D/g, ''));
    if (!Number.isFinite(n) || n < 0 || n > 20) return null;
    return Math.round(n);
  }
  if (fieldKey === 'preferredDate') {
    return normalizePreferredDateOrNull(s);
  }
  return s.slice(0, fieldKey === 'address' ? 512 : 120);
}

function draftFieldEmpty(draft: QuickPasteDraft, fieldKey: string): boolean {
  const v = draft[fieldKey as keyof QuickPasteDraft];
  return v == null || (typeof v === 'string' && !v.trim());
}

function setDraftField(draft: QuickPasteDraft, fieldKey: string, value: string | number | null) {
  if (value == null) return;
  if (fieldKey === 'customerName') draft.customerName = String(value);
  else if (fieldKey === 'customerPhone') draft.customerPhone = String(value);
  else if (fieldKey === 'address') draft.address = String(value);
  else if (fieldKey === 'preferredDate') draft.preferredDate = String(value);
  else if (fieldKey === 'preferredTime') draft.preferredTime = String(value);
  else if (fieldKey === 'serviceBalanceAmount') draft.serviceBalanceAmount = Number(value);
  else if (fieldKey === 'areaPyeong') draft.areaPyeong = Number(value);
  else if (fieldKey === 'roomCount') draft.roomCount = Number(value);
  else if (fieldKey === 'bathroomCount') draft.bathroomCount = Number(value);
  else if (fieldKey === 'balconyCount') draft.balconyCount = Number(value);
}

export async function loadQuickPasteTenantRules(db: PrismaClient, tenantId: string): Promise<TenantRuleRow[]> {
  return db.quickPasteTenantRule.findMany({
    where: { tenantId },
    orderBy: [{ fieldKey: 'asc' }, { sortOrder: 'asc' }, { hitCount: 'desc' }],
    select: { id: true, fieldKey: true, ruleType: true, pattern: true },
    take: 200,
  });
}

export async function applyQuickPasteTenantRules(
  db: PrismaClient,
  tenantId: string,
  rawText: string,
  draft: QuickPasteDraft,
): Promise<{ draft: QuickPasteDraft; appliedRuleIds: string[] }> {
  const rules = await loadQuickPasteTenantRules(db, tenantId);
  const next: QuickPasteDraft = { ...draft };
  const appliedRuleIds: string[] = [];
  const text = rawText.trim();

  for (const rule of rules) {
    if (draftFieldEmpty(next, rule.fieldKey) === false) continue;
    let rawValue: string | null = null;
    if (rule.ruleType === 'label_value') {
      const labels = rule.pattern
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      rawValue = applyLabelValueRule(text, labels);
    } else if (rule.ruleType === 'regex') {
      rawValue = applyRegexRule(text, rule.pattern);
    }
    if (!rawValue) continue;
    const coerced = coerceFieldValue(rule.fieldKey, rawValue);
    if (coerced == null) continue;
    setDraftField(next, rule.fieldKey, coerced);
    appliedRuleIds.push(rule.id);
  }

  if (appliedRuleIds.length > 0) {
    await db.quickPasteTenantRule.updateMany({
      where: { tenantId, id: { in: appliedRuleIds } },
      data: { hitCount: { increment: 1 } },
    });
  }

  return { draft: next, appliedRuleIds };
}

export function extractLabelNearValue(text: string, value: string): string | null {
  const needle = String(value).trim();
  if (!needle) return null;
  const idx = text.indexOf(needle);
  if (idx < 0) return null;
  const before = text.slice(Math.max(0, idx - 40), idx);
  const m = before.match(/([가-힣A-Za-z0-9/·]{1,12})\s*[:：]?\s*$/);
  const label = m?.[1]?.trim();
  if (!label || label.length < 1) return null;
  return label;
}

export async function upsertLearnedQuickPasteRule(
  db: PrismaClient,
  tenantId: string,
  fieldKey: string,
  label: string,
): Promise<{ id: string; fieldKey: string; pattern: string; created: boolean } | null> {
  const pattern = label.trim();
  if (!pattern) return null;
  const count = await db.quickPasteTenantRule.count({ where: { tenantId, fieldKey } });
  if (count >= 30) {
    console.warn('[quick-paste] learn skip — tenant rule limit', { tenantId, fieldKey });
    return null;
  }

  const existing = await db.quickPasteTenantRule.findFirst({
    where: { tenantId, fieldKey, ruleType: 'label_value', pattern },
    select: { id: true },
  });
  if (existing) {
    await db.quickPasteTenantRule.update({
      where: { id: existing.id },
      data: { hitCount: { increment: 1 } },
    });
    console.info('[quick-paste] learn hit', {
      tenantId,
      fieldKey,
      pattern,
      ruleId: existing.id,
      action: 'reinforced',
    });
    return { id: existing.id, fieldKey, pattern, created: false };
  }

  const maxSort = await db.quickPasteTenantRule.aggregate({
    where: { tenantId, fieldKey },
    _max: { sortOrder: true },
  });

  const row = await db.quickPasteTenantRule.create({
    data: {
      tenantId,
      fieldKey,
      ruleType: 'label_value',
      pattern,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      source: 'learned',
    },
    select: { id: true },
  });
  console.info('[quick-paste] learn created', {
    tenantId,
    fieldKey,
    pattern,
    ruleId: row.id,
    action: 'created',
  });
  return { id: row.id, fieldKey, pattern, created: true };
}
