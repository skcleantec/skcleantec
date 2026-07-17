import type { SoomgoChatAlert, SoomgoChatListSnapshotRow } from '@shared/soomgoBridge';

const MAX_ITEMS = 200;
const RETENTION_MS = 72 * 60 * 60 * 1000;

export type CrmSoomgoInboxItem = SoomgoChatAlert & {
  /** 카톡형 상단 고정 시각 (null = 미고정) */
  pinnedAt: number | null;
};

function storageKey(userId: string, brandSlug: string | null): string {
  const brand = brandSlug?.trim() || 'default';
  return `crmSoomgoInbox:${userId}:${brand}`;
}

function stableInboxId(chatId: string): string {
  return `sg-${chatId}`;
}

/** @deprecated localStorage 마이그레이션용 */
type LegacyInboxRow = CrmSoomgoInboxItem & {
  readAt?: number | null;
  watchUntil?: number | null;
};

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
    pinnedAt: row.pinnedAt ?? null,
  };
}

export function sortSoomgoInboxItems(items: CrmSoomgoInboxItem[]): CrmSoomgoInboxItem[] {
  return [...items].sort((a, b) => {
    const aPin = a.pinnedAt ?? 0;
    const bPin = b.pinnedAt ?? 0;
    if (aPin !== bPin) return bPin - aPin;
    return b.capturedAt - a.capturedAt;
  });
}

function pruneItems(items: CrmSoomgoInboxItem[]): CrmSoomgoInboxItem[] {
  const cutoff = Date.now() - RETENTION_MS;
  return sortSoomgoInboxItems(items)
    .filter((row) => row.capturedAt >= cutoff)
    .slice(0, MAX_ITEMS);
}

export function loadSoomgoChatInbox(userId: string | null, brandSlug: string | null): CrmSoomgoInboxItem[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId, brandSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyInboxRow[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const migrated = parsed
      .filter((row) => row && typeof row.chatId === 'string' && row.chatId.trim())
      .filter((row) => row.readAt == null)
      .map((row) =>
        normalizeItem({
          ...row,
          id: row.id?.startsWith('sg-') ? row.id : stableInboxId(row.chatId),
          pinnedAt:
            row.pinnedAt ??
            (row.watchUntil != null && row.watchUntil > now ? row.watchUntil : null),
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

export function isSoomgoInboxPinned(item: CrmSoomgoInboxItem): boolean {
  return item.pinnedAt != null;
}

/** 알림함 = 처리 대기 큐 — 모든 행이 미처리 */
export function isSoomgoInboxUnread(_item: CrmSoomgoInboxItem): boolean {
  return true;
}

export function soomgoInboxPendingCount(items: CrmSoomgoInboxItem[]): number {
  return items.length;
}

/** @deprecated soomgoInboxPendingCount 사용 */
export function unreadSoomgoInboxCount(items: CrmSoomgoInboxItem[]): number {
  return soomgoInboxPendingCount(items);
}

/** 고객명 · 서비스 라벨 분리 (띄어쓰기) */
export function formatSoomgoInboxCustomerName(raw: string | null): {
  displayName: string;
  serviceLabel: string | null;
} {
  const text = (raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { displayName: '고객', serviceLabel: null };

  const normalized = text.replace(
    /([가-힣a-zA-Z0-9])(이사\/입주|입주\/이사|입주\s*\/\s*이사|이사|입주|청소|외벽)/gi,
    '$1 $2',
  );

  const servicePatterns = [
    /^(.+?)\s+(이사\/입주(?:\s*청소)?)$/i,
    /^(.+?)\s+(입주\/이사(?:\s*청소)?)$/i,
    /^(.+?)\s+(이사|입주|청소|외벽(?:\s*청소)?)$/i,
  ];
  for (const pattern of servicePatterns) {
    const m = normalized.match(pattern);
    if (m) {
      return { displayName: m[1].trim(), serviceLabel: m[2].trim() };
    }
  }

  return { displayName: normalized, serviceLabel: null };
}

/** chatId 기준 1고객 1행 — 미리보기·미읽음 변경 시 상단 재정렬 */
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

    const previewKind = alert.previewKind ?? 'unknown';
    const unread = alert.unreadCount ?? 0;
    if (previewKind === 'smart_quote') continue;
    if (unread < 1 && previewKind !== 'quote_read') continue;

    const prev = byChatId.get(chatId);
    const previewText = alert.previewText?.trim() || '(내용 없음)';
    const capturedAt = alert.capturedAt ?? Date.now();

    if (!prev) {
      const row = normalizeItem({
        ...alert,
        id: stableInboxId(chatId),
        previewText,
        capturedAt,
        pinnedAt: null,
      });
      byChatId.set(chatId, row);
      added.push(row);
      continue;
    }

    const previewChanged = prev.previewText !== previewText;
    const unreadIncreased = unread > (prev.unreadCount ?? 0);
    const timeAdvanced = capturedAt > prev.capturedAt + 500;
    if (!previewChanged && !unreadIncreased && !timeAdvanced) continue;

    const row = normalizeItem({
      ...prev,
      ...alert,
      id: prev.id,
      previewText,
      capturedAt: Math.max(prev.capturedAt, capturedAt),
      pinnedAt: prev.pinnedAt,
    });
    byChatId.set(chatId, row);
    bumped.push(row);
  }

  return { items: pruneItems([...byChatId.values()]), added, bumped };
}

export function removeSoomgoInboxByChatId(
  items: CrmSoomgoInboxItem[],
  chatIds: string[],
): CrmSoomgoInboxItem[] {
  const chatSet = new Set(chatIds.map((c) => c.trim()).filter(Boolean));
  return items.filter((row) => !chatSet.has(row.chatId));
}

export function toggleSoomgoInboxPin(
  items: CrmSoomgoInboxItem[],
  chatId: string,
): CrmSoomgoInboxItem[] {
  const id = chatId.trim();
  if (!id) return items;
  const now = Date.now();
  return pruneItems(
    items.map((row) =>
      row.chatId === id ? { ...row, pinnedAt: row.pinnedAt != null ? null : now } : row,
    ),
  );
}

export function pinnedSoomgoChatIds(items: CrmSoomgoInboxItem[]): string[] {
  return items.filter((row) => row.pinnedAt != null).map((row) => row.chatId);
}

/** @deprecated pinnedSoomgoChatIds 사용 */
export function watchingSoomgoChatIds(items: CrmSoomgoInboxItem[]): string[] {
  return pinnedSoomgoChatIds(items);
}

/** 숨고 목록 스캔 — 미읽음 해소·대응 완료 건 알림함에서 제거 */
export function reconcileSoomgoInboxWithScan(
  items: CrmSoomgoInboxItem[],
  scanRows: SoomgoChatListSnapshotRow[],
): CrmSoomgoInboxItem[] {
  if (scanRows.length === 0) return items;
  const byChatId = new Map(scanRows.map((row) => [row.chatId, row]));
  return items.filter((item) => {
    const snap = byChatId.get(item.chatId);
    if (!snap) return true;
    if ((snap.unreadCount ?? 0) > 0) return true;
    if (snap.previewKind === 'quote_read') return true;
    return false;
  });
}

export function formatSoomgoAlertKind(kind: SoomgoChatAlert['previewKind']): string {
  if (kind === 'quote_read') return '견적 읽음';
  if (kind === 'message') return '메시지';
  if (kind === 'smart_quote') return '스마트견적';
  return '알림';
}

export function formatSoomgoInboxTime(capturedAt: number, listTimeLabel: string | null): string {
  if (listTimeLabel?.trim()) return listTimeLabel.trim();
  const d = new Date(capturedAt);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
