import type { SoomgoChatAlert, SoomgoChatListSnapshotRow } from '@shared/soomgoBridge';
import {
  evaluateSoomgoInboxMessageRules,
  resolveSoomgoInboxDisplayPreview,
  sanitizeSoomgoMessagePreview,
  type SoomgoInboxMessageRule,
} from '@shared/soomgoChatPreview';
import { formatSoomgoInboxDisplayName, parseSoomgoChatRow } from '@shared/soomgoChatRowParse';

const MAX_ITEMS = 200;
const RETENTION_MS = 72 * 60 * 60 * 1000;
const DISMISS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type CrmSoomgoInboxItem = SoomgoChatAlert & {
  /** 카톡형 상단 고정 시각 (null = 미고정) */
  pinnedAt: number | null;
  /** 강조 키워드 규칙 매칭 */
  highlighted?: boolean;
};

function messageTextForRules(item: Pick<CrmSoomgoInboxItem, 'messagePreview' | 'previewText'>): string | null {
  return item.messagePreview ?? item.previewText ?? null;
}

/** 규칙 적용 — exclude면 null(고정 핀은 유지), highlight 플래그 반영 */
export function decorateSoomgoInboxItemWithRules(
  item: CrmSoomgoInboxItem,
  rules: SoomgoInboxMessageRule[],
): CrmSoomgoInboxItem | null {
  const { excluded, highlighted } = evaluateSoomgoInboxMessageRules(messageTextForRules(item), rules);
  if (excluded && !isSoomgoInboxPinned(item)) return null;
  return { ...item, highlighted };
}

export function reapplySoomgoInboxRules(
  items: CrmSoomgoInboxItem[],
  rules: SoomgoInboxMessageRule[],
): CrmSoomgoInboxItem[] {
  const next: CrmSoomgoInboxItem[] = [];
  for (const item of items) {
    const decorated = decorateSoomgoInboxItemWithRules(item, rules);
    if (decorated) next.push(decorated);
  }
  return pruneItems(next);
}

/** @deprecated sanitizeSoomgoMessagePreview 사용 */
export function sanitizeSoomgoInboxPreviewText(text: string | null | undefined): string {
  const cleaned = sanitizeSoomgoMessagePreview(text);
  return cleaned || '(채팅 미리보기)';
}

/** 사용자가 읽음·열기로 숨긴 알림 — 동일 알림이 스캔에 남아도 재표시하지 않음 */
export type SoomgoInboxDismissSnapshot = {
  unreadCount: number;
  previewText: string;
  messagePreview?: string | null;
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

function stableInboxId(chatId: string): string {
  return `sg-${chatId}`;
}

/** @deprecated localStorage 마이그레이션용 */
type LegacyInboxRow = CrmSoomgoInboxItem & {
  readAt?: number | null;
  watchUntil?: number | null;
};

function normalizeItem(
  row: Partial<CrmSoomgoInboxItem> & { chatId: string; rawLines?: string[] | null },
): CrmSoomgoInboxItem {
  const base = {
    id: row.id?.trim() || stableInboxId(row.chatId),
    chatId: row.chatId,
    serviceRegion: null as string | null,
    unreadCount: row.unreadCount ?? 0,
    listTimeLabel: row.listTimeLabel ?? null,
    capturedAt: row.capturedAt ?? Date.now(),
    pinnedAt: row.pinnedAt ?? null,
  };

  if (row.parseQuality === 'dom') {
    const messagePreview = sanitizeSoomgoMessagePreview(row.messagePreview) || null;
    const previewText = messagePreview || '(채팅 미리보기)';
    return {
      ...base,
      customerName: row.customerName?.trim() || null,
      previewText,
      messagePreview,
      parseQuality: 'dom',
      previewKind: row.previewKind ?? (messagePreview ? 'message' : 'unknown'),
    };
  }

  const rawLines = row.rawLines?.length ? row.rawLines : undefined;
  const rawBlock =
    rawLines?.join('\n') ??
    sanitizeSoomgoMessagePreview(row.messagePreview ?? row.previewText) ??
    undefined;

  const parsed = parseSoomgoChatRow({
    rawLines,
    rawBlock,
    customerName: row.customerName,
    serviceRegion: row.serviceRegion,
    messagePreview: row.messagePreview,
    previewText: row.previewText,
  });

  return {
    ...base,
    customerName: parsed.customerName,
    previewText: parsed.previewText,
    messagePreview: parsed.messagePreview,
    parseQuality: parsed.parseQuality,
    previewKind: parsed.previewKind,
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
  row: Pick<SoomgoChatListSnapshotRow, 'unreadCount' | 'previewText' | 'messagePreview' | 'previewKind'>,
  dismiss: SoomgoInboxDismissSnapshot | undefined,
): boolean {
  if (!dismiss) return true;
  if ((row.unreadCount ?? 0) > dismiss.unreadCount) return true;
  if (row.previewKind === 'quote_read' && dismiss.previewKind !== 'quote_read') return true;
  const preview = sanitizeSoomgoMessagePreview(row.messagePreview ?? row.previewText);
  const dismissedPreview = sanitizeSoomgoMessagePreview(dismiss.messagePreview ?? dismiss.previewText);
  if (preview !== dismissedPreview && preview) return true;
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

/** 고객명 표시 — 1줄 이름만 */
export function formatSoomgoInboxCustomerName(raw: string | null): {
  displayName: string;
  serviceLabel: string | null;
} {
  const parsed = parseSoomgoChatRow({ customerName: raw, rawBlock: raw });
  if (parsed.customerName) {
    return { displayName: parsed.customerName, serviceLabel: null };
  }
  const text = (raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { displayName: '(이름 미확인)', serviceLabel: null };
  return { displayName: formatSoomgoInboxDisplayName({ customerName: pickNameFromMerged(text) }), serviceLabel: null };
}

function pickNameFromMerged(text: string): string | null {
  const picked = parseSoomgoChatRow({ rawBlock: text });
  return picked.customerName;
}

/** chatId 기준 1고객 1행 — 미리보기·미읽음 변경 시 상단 재정렬 */
export function upsertSoomgoChatAlerts(
  existing: CrmSoomgoInboxItem[],
  incoming: SoomgoChatAlert[],
  rules: SoomgoInboxMessageRule[] = [],
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
    const previewText = resolveSoomgoInboxDisplayPreview(alert);
    const messagePreview = sanitizeSoomgoMessagePreview(alert.messagePreview ?? alert.previewText) || null;
    const capturedAt = alert.capturedAt ?? Date.now();

    if (!prev) {
      const normalized = normalizeItem({
        ...alert,
        id: stableInboxId(chatId),
        previewText,
        messagePreview,
        capturedAt,
        pinnedAt: null,
      });
      const row = decorateSoomgoInboxItemWithRules(normalized, rules);
      if (!row) continue;
      if (!row.customerName && !row.messagePreview) continue;
      byChatId.set(chatId, row);
      added.push(row);
      continue;
    }

    const previewChanged =
      prev.previewText !== previewText ||
      (prev.messagePreview ?? '') !== (messagePreview ?? '');
    const unreadIncreased = unread > (prev.unreadCount ?? 0);
    const timeAdvanced = capturedAt > prev.capturedAt + 500;
    if (!previewChanged && !unreadIncreased && !timeAdvanced) continue;

    let row = normalizeItem({
      ...prev,
      ...alert,
      id: prev.id,
      previewText,
      messagePreview,
      capturedAt: Math.max(prev.capturedAt, capturedAt),
      pinnedAt: prev.pinnedAt,
    });
    if (!row.customerName && prev.customerName) {
      row.customerName = prev.customerName;
    }
    if (!row.messagePreview && prev.messagePreview) {
      row.messagePreview = prev.messagePreview;
      row.previewText = prev.previewText;
    }
    const decorated = decorateSoomgoInboxItemWithRules(row, rules);
    if (!decorated) {
      byChatId.delete(chatId);
      continue;
    }
    row = decorated;
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
      messagePreview: row.messagePreview ?? null,
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
  rules: SoomgoInboxMessageRule[] = [],
): CrmSoomgoInboxItem[] {
  if (scanRows.length === 0) return existing;

  const scanByChatId = new Map(scanRows.map((row) => [row.chatId, row]));
  const resultByChat = new Map<string, CrmSoomgoInboxItem>();

  for (const row of existing) {
    if (row.pinnedAt == null) continue;
    const snap = scanByChatId.get(row.chatId);
    const merged = snap
      ? normalizeItem({ ...snap, id: row.id, pinnedAt: row.pinnedAt })
      : row;
    const decorated = decorateSoomgoInboxItemWithRules(merged, rules);
    if (decorated) resultByChat.set(row.chatId, decorated);
  }

  for (const snap of scanRows) {
    if (!isSoomgoScanAlertActive(snap)) continue;
    if (resultByChat.has(snap.chatId)) continue;
    const dismiss = dismissals?.get(snap.chatId);
    if (dismiss && !isSoomgoAlertChangedSinceDismiss(snap, dismiss)) continue;
    const normalized = normalizeItem({
      ...snap,
      id: stableInboxId(snap.chatId),
      pinnedAt: null,
    });
    const decorated = decorateSoomgoInboxItemWithRules(normalized, rules);
    if (decorated) resultByChat.set(snap.chatId, decorated);
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
  if (kind === 'system') return '시스템';
  if (kind === 'smart_quote') return '스마트견적';
  return '알림';
}

export function formatSoomgoInboxTime(capturedAt: number, listTimeLabel: string | null): string {
  if (listTimeLabel?.trim()) return listTimeLabel.trim();
  const d = new Date(capturedAt);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
