import type { SoomgoChatAlert } from '@shared/soomgoBridge';

const MAX_ITEMS = 200;
const RETENTION_MS = 72 * 60 * 60 * 1000;
/** 대기(집중 감시) 유지 시간 */
export const SOOMGO_INBOX_WATCH_MS = 24 * 60 * 60 * 1000;

export type CrmSoomgoInboxItem = SoomgoChatAlert & {
  readAt: number | null;
  watchUntil: number | null;
};

function storageKey(userId: string, brandSlug: string | null): string {
  const brand = brandSlug?.trim() || 'default';
  return `crmSoomgoInbox:${userId}:${brand}`;
}

function stableInboxId(chatId: string): string {
  return `sg-${chatId}`;
}

function normalizeItem(row: Partial<CrmSoomgoInboxItem> & { chatId: string }): CrmSoomgoInboxItem {
  return {
    id: row.id?.trim() || stableInboxId(row.chatId),
    chatId: row.chatId,
    customerName: row.customerName ?? null,
    previewText: row.previewText?.trim() || '(내용 없음)',
    previewKind: row.previewKind ?? 'unknown',
    unreadCount: row.unreadCount ?? 0,
    listTimeLabel: row.listTimeLabel ?? null,
    capturedAt: row.capturedAt ?? Date.now(),
    readAt: row.readAt ?? null,
    watchUntil: row.watchUntil ?? null,
  };
}

function pruneItems(items: CrmSoomgoInboxItem[]): CrmSoomgoInboxItem[] {
  const cutoff = Date.now() - RETENTION_MS;
  const now = Date.now();
  return items
    .filter((row) => row.capturedAt >= cutoff)
    .map((row) =>
      row.watchUntil != null && row.watchUntil <= now ? { ...row, watchUntil: null } : row,
    )
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, MAX_ITEMS);
}

export function loadSoomgoChatInbox(userId: string | null, brandSlug: string | null): CrmSoomgoInboxItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId, brandSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CrmSoomgoInboxItem[];
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed
      .filter((row) => row && typeof row.chatId === 'string' && row.chatId.trim())
      .map((row) =>
        normalizeItem({
          ...row,
          id: row.id?.startsWith('sg-') ? row.id : stableInboxId(row.chatId),
          watchUntil: row.watchUntil ?? null,
        }),
      );
    return pruneItems(migrated);
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
    localStorage.setItem(storageKey(userId, brandSlug), JSON.stringify(pruneItems(items)));
  } catch {
    /* ignore */
  }
}

export function isSoomgoInboxWatching(item: CrmSoomgoInboxItem, now = Date.now()): boolean {
  return item.watchUntil != null && item.watchUntil > now;
}

export function isSoomgoInboxUnread(item: CrmSoomgoInboxItem): boolean {
  return item.readAt == null;
}

/** chatId 기준 1고객 1행 — 미리보기 변경 시 상단 재정렬·미읽음 복귀 */
export function upsertSoomgoChatAlerts(
  existing: CrmSoomgoInboxItem[],
  incoming: SoomgoChatAlert[],
): { items: CrmSoomgoInboxItem[]; added: CrmSoomgoInboxItem[]; bumped: CrmSoomgoInboxItem[] } {
  const byChatId = new Map<string, CrmSoomgoInboxItem>();
  for (const row of existing) {
    if (row.chatId?.trim()) byChatId.set(row.chatId, row);
  }

  const added: CrmSoomgoInboxItem[] = [];
  const bumped: CrmSoomgoInboxItem[] = [];

  for (const alert of incoming) {
    const chatId = alert?.chatId?.trim();
    if (!chatId) continue;

    const prev = byChatId.get(chatId);
    const previewText = alert.previewText?.trim() || '(내용 없음)';
    const capturedAt = alert.capturedAt ?? Date.now();

    if (!prev) {
      const row = normalizeItem({
        ...alert,
        id: stableInboxId(chatId),
        previewText,
        capturedAt,
        readAt: null,
        watchUntil: null,
      });
      byChatId.set(chatId, row);
      added.push(row);
      continue;
    }

    const previewChanged = prev.previewText !== previewText;
    const unreadIncreased = (alert.unreadCount ?? 0) > (prev.unreadCount ?? 0);
    const timeAdvanced = capturedAt > prev.capturedAt + 500;
    if (!previewChanged && !unreadIncreased && !timeAdvanced) continue;

    const becameUnread =
      prev.readAt != null && (previewChanged || unreadIncreased || (alert.unreadCount ?? 0) > 0);

    const row = normalizeItem({
      ...prev,
      ...alert,
      id: prev.id,
      previewText,
      capturedAt: Math.max(prev.capturedAt, capturedAt),
      readAt: becameUnread ? null : prev.readAt,
      watchUntil: prev.watchUntil,
    });
    byChatId.set(chatId, row);
    bumped.push(row);
  }

  return { items: pruneItems([...byChatId.values()]), added, bumped };
}

/** @deprecated upsertSoomgoChatAlerts 사용 */
export function mergeSoomgoChatAlerts(
  existing: CrmSoomgoInboxItem[],
  incoming: SoomgoChatAlert[],
): { items: CrmSoomgoInboxItem[]; added: CrmSoomgoInboxItem[] } {
  const { items, added } = upsertSoomgoChatAlerts(existing, incoming);
  return { items, added };
}

export function markSoomgoInboxRead(items: CrmSoomgoInboxItem[], ids: string[]): CrmSoomgoInboxItem[] {
  const idSet = new Set(ids);
  const now = Date.now();
  return items.map((row) =>
    idSet.has(row.id) ? { ...row, readAt: row.readAt ?? now, watchUntil: null } : row,
  );
}

export function markSoomgoInboxReadByChatId(
  items: CrmSoomgoInboxItem[],
  chatIds: string[],
): CrmSoomgoInboxItem[] {
  const chatSet = new Set(chatIds.map((c) => c.trim()).filter(Boolean));
  const now = Date.now();
  return items.map((row) =>
    chatSet.has(row.chatId) ? { ...row, readAt: row.readAt ?? now, watchUntil: null } : row,
  );
}

export function markSoomgoInboxWatching(
  items: CrmSoomgoInboxItem[],
  chatIds: string[],
  durationMs: number = SOOMGO_INBOX_WATCH_MS,
): CrmSoomgoInboxItem[] {
  const chatSet = new Set(chatIds.map((c) => c.trim()).filter(Boolean));
  const until = Date.now() + durationMs;
  return items.map((row) => (chatSet.has(row.chatId) ? { ...row, watchUntil: until } : row));
}

export function clearSoomgoInboxWatching(items: CrmSoomgoInboxItem[], chatIds: string[]): CrmSoomgoInboxItem[] {
  const chatSet = new Set(chatIds.map((c) => c.trim()).filter(Boolean));
  return items.map((row) => (chatSet.has(row.chatId) ? { ...row, watchUntil: null } : row));
}

export function watchingSoomgoChatIds(items: CrmSoomgoInboxItem[], now = Date.now()): string[] {
  return items.filter((row) => row.watchUntil != null && row.watchUntil > now).map((row) => row.chatId);
}

export function unreadSoomgoInboxCount(items: CrmSoomgoInboxItem[]): number {
  return items.filter((row) => row.readAt == null).length;
}

export function formatSoomgoAlertKind(kind: SoomgoChatAlert['previewKind']): string {
  if (kind === 'quote_read') return '견적 읽음';
  if (kind === 'message') return '메시지';
  return '알림';
}

export function formatSoomgoInboxTime(capturedAt: number, listTimeLabel: string | null): string {
  if (listTimeLabel?.trim()) return listTimeLabel.trim();
  const d = new Date(capturedAt);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
