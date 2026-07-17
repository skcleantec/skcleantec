import type { SoomgoChatAlert, SoomgoChatListSnapshotRow } from '@shared/soomgoBridge';

const MAX_ITEMS = 200;
const RETENTION_MS = 72 * 60 * 60 * 1000;
const DISMISS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type CrmSoomgoInboxItem = SoomgoChatAlert & {
  /** 카톡형 상단 고정 시각 (null = 미고정) */
  pinnedAt: number | null;
};

/** 사용자가 읽음·열기로 숨긴 알림 — 동일 알림이 스캔에 남아도 재표시하지 않음 */
export type SoomgoInboxDismissSnapshot = {
  unreadCount: number;
  previewText: string;
  previewKind: SoomgoChatAlert['previewKind'];
  dismissedAt: number;
};

function storageKey(userId: string, brandSlug: string | null): string {
  const brand = brandSlug?.trim() || 'default';
  return `crmSoomgoInbox:${userId}:${brand}`;
}

function dismissStorageKey(userId: string, brandSlug: string | null): string {
  const brand = brandSlug?.trim() || 'default';
  return `crmSoomgoInboxDismiss:${userId}:${brand}`;
}

export function sanitizeSoomgoInboxPreviewText(text: string | null | undefined): string {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '(내용 없음)';
  if (/^\d{1,2}$/.test(trimmed)) return '(채팅 미리보기)';
  return trimmed;
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
    serviceRegion: row.serviceRegion ?? null,
    previewText: sanitizeSoomgoInboxPreviewText(row.previewText),
    previewKind: row.previewKind ?? 'unknown',
    unreadCount: row.unreadCount ?? 0,
    listTimeLabel: row.listTimeLabel ?? null,
    capturedAt: row.capturedAt ?? Date.now(),
    pinnedAt: row.pinnedAt ?? null,
  };
}

function inboxActionPriority(item: CrmSoomgoInboxItem): number {
  if ((item.unreadCount ?? 0) > 0) return 3;
  if (item.previewKind === 'quote_read') return 2;
  return 1;
}

export function sortSoomgoInboxItems(items: CrmSoomgoInboxItem[]): CrmSoomgoInboxItem[] {
  return [...items].sort((a, b) => {
    const aPin = a.pinnedAt ?? 0;
    const bPin = b.pinnedAt ?? 0;
    if (aPin !== bPin) return bPin - aPin;
    const aAction = inboxActionPriority(a);
    const bAction = inboxActionPriority(b);
    if (aAction !== bAction) return bAction - aAction;
    return b.capturedAt - a.capturedAt;
  });
}

/** 숨고 목록에서 현재 알림 대상인 행인지 — 미읽음 배지 또는 견적 읽음만 */
export function isSoomgoScanAlertActive(row: SoomgoChatListSnapshotRow): boolean {
  if (row.previewKind === 'smart_quote') return false;
  if ((row.unreadCount ?? 0) > 0) return true;
  if (row.previewKind === 'quote_read') return true;
  return false;
}

export function isSoomgoAlertChangedSinceDismiss(
  row: Pick<SoomgoChatListSnapshotRow, 'unreadCount' | 'previewText' | 'previewKind'>,
  dismiss: SoomgoInboxDismissSnapshot | undefined,
): boolean {
  if (!dismiss) return true;
  if ((row.unreadCount ?? 0) > dismiss.unreadCount) return true;
  if (row.previewKind === 'quote_read' && dismiss.previewKind !== 'quote_read') return true;
  const preview = sanitizeSoomgoInboxPreviewText(row.previewText);
  const dismissedPreview = sanitizeSoomgoInboxPreviewText(dismiss.previewText);
  if (preview !== dismissedPreview && preview !== '(채팅 미리보기)') return true;
  return false;
}

export function loadSoomgoInboxDismissals(
  userId: string | null,
  brandSlug: string | null,
): Map<string, SoomgoInboxDismissSnapshot> {
  if (!userId) return new Map();
  try {
    const raw = localStorage.getItem(dismissStorageKey(userId, brandSlug));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, SoomgoInboxDismissSnapshot>;
    if (!parsed || typeof parsed !== 'object') return new Map();
    const cutoff = Date.now() - DISMISS_RETENTION_MS;
    const map = new Map<string, SoomgoInboxDismissSnapshot>();
    for (const [chatId, snap] of Object.entries(parsed)) {
      if (!chatId.trim() || !snap || typeof snap.dismissedAt !== 'number') continue;
      if (snap.dismissedAt < cutoff) continue;
      map.set(chatId, snap);
    }
    return map;
  } catch {
    return new Map();
  }
}

export function saveSoomgoInboxDismissals(
  userId: string | null,
  brandSlug: string | null,
  dismissals: Map<string, SoomgoInboxDismissSnapshot>,
): void {
  if (!userId) return;
  try {
    const cutoff = Date.now() - DISMISS_RETENTION_MS;
    const obj: Record<string, SoomgoInboxDismissSnapshot> = {};
    for (const [chatId, snap] of dismissals.entries()) {
      if (snap.dismissedAt >= cutoff) obj[chatId] = snap;
    }
    localStorage.setItem(dismissStorageKey(userId, brandSlug), JSON.stringify(obj));
  } catch {
    /* ignore */
  }
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

/** 읽음·열기 — 고정 핀은 유지, 나머지는 제거 + 스캔 재동기화 시 같은 알림 숨김 */
export function dismissSoomgoInboxItems(
  items: CrmSoomgoInboxItem[],
  chatIds: string[],
  dismissals: Map<string, SoomgoInboxDismissSnapshot>,
): { items: CrmSoomgoInboxItem[]; dismissals: Map<string, SoomgoInboxDismissSnapshot> } {
  const chatSet = new Set(chatIds.map((c) => c.trim()).filter(Boolean));
  const now = Date.now();
  const nextDismissals = new Map(dismissals);
  const nextItems = items.filter((row) => {
    if (!chatSet.has(row.chatId)) return true;
    if (isSoomgoInboxPinned(row)) return true;
    nextDismissals.set(row.chatId, {
      unreadCount: row.unreadCount ?? 0,
      previewText: row.previewText,
      previewKind: row.previewKind,
      dismissedAt: now,
    });
    return false;
  });
  return { items: nextItems, dismissals: nextDismissals };
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

/** 숨고 채팅 목록 live 스캔 — 미읽음·견적 읽음만, 고정·숨김 상태 반영 */
export function syncSoomgoInboxFromScan(
  existing: CrmSoomgoInboxItem[],
  scanRows: SoomgoChatListSnapshotRow[],
  dismissals?: Map<string, SoomgoInboxDismissSnapshot>,
): CrmSoomgoInboxItem[] {
  if (scanRows.length === 0) return existing;

  const scanByChatId = new Map(scanRows.map((row) => [row.chatId, row]));
  const resultByChat = new Map<string, CrmSoomgoInboxItem>();

  for (const row of existing) {
    if (row.pinnedAt == null) continue;
    const snap = scanByChatId.get(row.chatId);
    resultByChat.set(
      row.chatId,
      snap
        ? normalizeItem({ ...snap, id: row.id, pinnedAt: row.pinnedAt })
        : row,
    );
  }

  for (const snap of scanRows) {
    if (!isSoomgoScanAlertActive(snap)) continue;
    if (resultByChat.has(snap.chatId)) continue;
    const dismiss = dismissals?.get(snap.chatId);
    if (dismiss && !isSoomgoAlertChangedSinceDismiss(snap, dismiss)) continue;
    resultByChat.set(
      snap.chatId,
      normalizeItem({
        ...snap,
        id: stableInboxId(snap.chatId),
        pinnedAt: null,
      }),
    );
  }

  return pruneItems([...resultByChat.values()]);
}

/** @deprecated syncSoomgoInboxFromScan 사용 */
export function reconcileSoomgoInboxWithScan(
  items: CrmSoomgoInboxItem[],
  scanRows: SoomgoChatListSnapshotRow[],
): CrmSoomgoInboxItem[] {
  return syncSoomgoInboxFromScan(items, scanRows);
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
