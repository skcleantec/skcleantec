import type { SoomgoChatAlert } from '@shared/soomgoBridge';

const MAX_ITEMS = 200;
const RETENTION_MS = 72 * 60 * 60 * 1000;

export type CrmSoomgoInboxItem = SoomgoChatAlert & {
  readAt: number | null;
};

function storageKey(userId: string, brandSlug: string | null): string {
  const brand = brandSlug?.trim() || 'default';
  return `crmSoomgoInbox:${userId}:${brand}`;
}

export function loadSoomgoChatInbox(userId: string | null, brandSlug: string | null): CrmSoomgoInboxItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId, brandSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CrmSoomgoInboxItem[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RETENTION_MS;
    return parsed
      .filter((row) => row && typeof row.id === 'string' && row.capturedAt >= cutoff)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveSoomgoChatInbox(
  userId: string | null,
  brandSlug: string | null,
  items: CrmSoomgoInboxItem[],
): void {
  if (!userId) return;
  try {
    const cutoff = Date.now() - RETENTION_MS;
    const trimmed = items.filter((row) => row.capturedAt >= cutoff).slice(0, MAX_ITEMS);
    localStorage.setItem(storageKey(userId, brandSlug), JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function mergeSoomgoChatAlerts(
  existing: CrmSoomgoInboxItem[],
  incoming: SoomgoChatAlert[],
): { items: CrmSoomgoInboxItem[]; added: CrmSoomgoInboxItem[] } {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const added: CrmSoomgoInboxItem[] = [];
  for (const alert of incoming) {
    if (!alert?.id || byId.has(alert.id)) continue;
    const row: CrmSoomgoInboxItem = { ...alert, readAt: null };
    byId.set(row.id, row);
    added.push(row);
  }
  const items = [...byId.values()].sort((a, b) => b.capturedAt - a.capturedAt).slice(0, MAX_ITEMS);
  return { items, added };
}

export function markSoomgoInboxRead(items: CrmSoomgoInboxItem[], ids: string[]): CrmSoomgoInboxItem[] {
  const idSet = new Set(ids);
  const now = Date.now();
  return items.map((row) => (idSet.has(row.id) ? { ...row, readAt: row.readAt ?? now } : row));
}

export function unreadSoomgoInboxCount(items: CrmSoomgoInboxItem[]): number {
  return items.filter((row) => row.readAt == null).length;
}

export function formatSoomgoAlertKind(kind: SoomgoChatAlert['previewKind']): string {
  if (kind === 'quote_read') return '견적 읽음';
  if (kind === 'message') return '고객 메시지';
  return '알림';
}

export function formatSoomgoInboxTime(capturedAt: number, listTimeLabel: string | null): string {
  if (listTimeLabel?.trim()) return listTimeLabel.trim();
  const d = new Date(capturedAt);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
