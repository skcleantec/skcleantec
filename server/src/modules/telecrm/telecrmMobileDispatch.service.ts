import { sendJsonToUser } from '../realtime/realtimeHub.js';

export type TelecrmMobileDispatchAction = 'call' | 'sms';

export type TelecrmMobileDispatchItem = {
  id: string;
  action: TelecrmMobileDispatchAction;
  phone: string;
  body: string | null;
  imageUrl: string | null;
  inquiryId: string | null;
  customerMatch: string | null;
  createdAt: string;
};

type QueueKey = string;

const TTL_MS = 5 * 60 * 1000;
const MAX_QUEUE = 8;

/** tenantId:userId → pending dispatches (WS miss fallback) */
const queues = new Map<QueueKey, TelecrmMobileDispatchItem[]>();

function queueKey(tenantId: string, userId: string): QueueKey {
  return `${tenantId}:${userId}`;
}

function pruneQueue(items: TelecrmMobileDispatchItem[]): TelecrmMobileDispatchItem[] {
  const cutoff = Date.now() - TTL_MS;
  return items.filter((i) => new Date(i.createdAt).getTime() >= cutoff).slice(-MAX_QUEUE);
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 20);
}

export function parseTelecrmMobileDispatchBody(body: unknown):
  | Omit<TelecrmMobileDispatchItem, 'id' | 'createdAt'>
  | { error: string } {
  if (!body || typeof body !== 'object') return { error: '요청 본문이 필요합니다.' };
  const b = body as Record<string, unknown>;
  const actionRaw = typeof b.action === 'string' ? b.action.trim().toLowerCase() : '';
  if (actionRaw !== 'call' && actionRaw !== 'sms') {
    return { error: 'action은 call 또는 sms 여야 합니다.' };
  }
  const phone = normalizePhone(typeof b.phone === 'string' ? b.phone : '');
  if (phone.length < 4) return { error: '전화번호(4자 이상)가 필요합니다.' };
  const smsBody = typeof b.body === 'string' ? b.body.trim().slice(0, 4000) : '';
  const imageUrl =
    typeof b.imageUrl === 'string' && b.imageUrl.trim() ? b.imageUrl.trim().slice(0, 512) : null;
  if (actionRaw === 'sms' && !smsBody && !imageUrl) {
    return { error: '문자 내용(body) 또는 imageUrl이 필요합니다.' };
  }
  const inquiryId = typeof b.inquiryId === 'string' && b.inquiryId.trim() ? b.inquiryId.trim() : null;
  const customerMatch =
    typeof b.customerMatch === 'string' && b.customerMatch.trim()
      ? b.customerMatch.trim().slice(0, 16)
      : null;
  return {
    action: actionRaw,
    phone,
    body: actionRaw === 'sms' ? smsBody || null : null,
    imageUrl: actionRaw === 'sms' ? imageUrl : null,
    inquiryId,
    customerMatch,
  };
}

export function enqueueTelecrmMobileDispatch(
  tenantId: string,
  userId: string,
  parsed: Omit<TelecrmMobileDispatchItem, 'id' | 'createdAt'>,
): { item: TelecrmMobileDispatchItem; wsDelivered: boolean } {
  const item: TelecrmMobileDispatchItem = {
    ...parsed,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const key = queueKey(tenantId, userId);
  const next = pruneQueue([...(queues.get(key) ?? []), item]);
  queues.set(key, next);
  const wsDelivered = sendJsonToUser(
    userId,
    {
      type: 'telecrm:dispatch',
      id: item.id,
      action: item.action,
      phone: item.phone,
      body: item.body,
      imageUrl: item.imageUrl,
      inquiryId: item.inquiryId,
      customerMatch: item.customerMatch,
    },
    tenantId,
  );
  return { item, wsDelivered };
}

export function drainTelecrmMobileDispatchQueue(
  tenantId: string,
  userId: string,
): TelecrmMobileDispatchItem[] {
  const key = queueKey(tenantId, userId);
  const items = pruneQueue(queues.get(key) ?? []);
  queues.delete(key);
  return items;
}
