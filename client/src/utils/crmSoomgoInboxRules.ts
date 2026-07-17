import type { SoomgoInboxMessageRule, SoomgoInboxRuleAction } from '@shared/soomgoChatPreview';

const RULES_CHANGED = 'crmSoomgoInboxRulesChanged';

function rulesStorageKey(userId: string, brandSlug: string | null): string {
  const brand = brandSlug?.trim() || 'default';
  return `crmSoomgoInboxRules:${userId}:${brand}`;
}

function newRuleId(): string {
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSoomgoInboxMessageRule(
  keyword: string,
  action: SoomgoInboxRuleAction,
): SoomgoInboxMessageRule {
  return {
    id: newRuleId(),
    keyword: keyword.trim(),
    action,
    enabled: true,
  };
}

function normalizeStoredRule(raw: unknown): SoomgoInboxMessageRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<SoomgoInboxMessageRule>;
  if (typeof row.id !== 'string' || !row.id.trim()) return null;
  if (typeof row.keyword !== 'string' || !row.keyword.trim()) return null;
  if (row.action !== 'exclude' && row.action !== 'highlight') return null;
  return {
    id: row.id.trim(),
    keyword: row.keyword.trim(),
    action: row.action,
    enabled: row.enabled !== false,
  };
}

export function loadSoomgoInboxRules(
  userId: string | null,
  brandSlug: string | null,
): SoomgoInboxMessageRule[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(rulesStorageKey(userId, brandSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredRule).filter((row): row is SoomgoInboxMessageRule => row != null);
  } catch {
    return [];
  }
}

export function saveSoomgoInboxRules(
  userId: string | null,
  brandSlug: string | null,
  rules: SoomgoInboxMessageRule[],
): void {
  if (!userId) return;
  try {
    const cleaned = rules
      .map(normalizeStoredRule)
      .filter((row): row is SoomgoInboxMessageRule => row != null);
    localStorage.setItem(rulesStorageKey(userId, brandSlug), JSON.stringify(cleaned));
    window.dispatchEvent(
      new CustomEvent(RULES_CHANGED, {
        detail: { userId, brandSlug: brandSlug?.trim() || null },
      }),
    );
  } catch {
    /* ignore */
  }
}

export function subscribeSoomgoInboxRulesChanged(
  listener: (detail: { userId: string; brandSlug: string | null }) => void,
): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ userId?: string; brandSlug?: string | null }>;
    const userId = custom.detail?.userId;
    if (!userId) return;
    listener({ userId, brandSlug: custom.detail?.brandSlug ?? null });
  };
  window.addEventListener(RULES_CHANGED, handler);
  return () => window.removeEventListener(RULES_CHANGED, handler);
}
