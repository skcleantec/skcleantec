import type { TelecrmChatSummaryDto } from '../api/telecrm';

const STORAGE_PREFIX = 'crm.aiSummary.v1';

function storageKey(tenantSlug: string, chatId: string, contentHash: string): string {
  return `${STORAGE_PREFIX}:${tenantSlug}:${chatId}:${contentHash}`;
}

export function loadCrmAiSummarySession(
  tenantSlug: string | undefined,
  chatId: string,
  contentHash: string,
): TelecrmChatSummaryDto | null {
  const slug = (tenantSlug || '_default').trim() || '_default';
  try {
    const raw = sessionStorage.getItem(storageKey(slug, chatId, contentHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TelecrmChatSummaryDto;
    if (!parsed || typeof parsed.summary !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCrmAiSummarySession(
  tenantSlug: string | undefined,
  chatId: string,
  contentHash: string,
  summary: TelecrmChatSummaryDto,
): void {
  const slug = (tenantSlug || '_default').trim() || '_default';
  try {
    sessionStorage.setItem(storageKey(slug, chatId, contentHash), JSON.stringify(summary));
  } catch {
    /* ignore quota */
  }
}

export function clearCrmAiSummarySession(
  tenantSlug: string | undefined,
  chatId: string,
  contentHash?: string,
): void {
  const slug = (tenantSlug || '_default').trim() || '_default';
  if (contentHash) {
    try {
      sessionStorage.removeItem(storageKey(slug, chatId, contentHash));
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const prefix = `${STORAGE_PREFIX}:${slug}:${chatId}:`;
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
