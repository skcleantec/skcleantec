import type { Prisma, TelecrmMobileDispatchPending } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { deliverTelecrmDispatch } from '../realtime/realtimeHub.js';

export type TelecrmMobileDispatchAction = 'call' | 'sms' | 'prefill';

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

const TTL_MS = 5 * 60 * 1000;
const MAX_BATCH = 8;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 20);
}

function rowToItem(row: TelecrmMobileDispatchPending): TelecrmMobileDispatchItem {
  return {
    id: row.id,
    action: row.action as TelecrmMobileDispatchAction,
    phone: row.phone,
    body: row.body,
    imageUrl: row.imageUrl,
    inquiryId: row.inquiryId,
    customerMatch: row.customerMatch,
    createdAt: row.createdAt.toISOString(),
  };
}

function dispatchWsPayload(item: TelecrmMobileDispatchItem): object {
  return {
    type: 'telecrm:dispatch',
    id: item.id,
    action: item.action,
    phone: item.phone,
    body: item.body,
    imageUrl: item.imageUrl,
    inquiryId: item.inquiryId,
    customerMatch: item.customerMatch,
  };
}

function pendingWhereForUser(tenantId: string, userId: string): Prisma.TelecrmMobileDispatchPendingWhereInput {
  return {
    tenantId,
    OR: [{ userId, broadcastToTenant: false }, { broadcastToTenant: true }],
  };
}

async function pruneExpired(tenantId: string, userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - TTL_MS);
  await prisma.telecrmMobileDispatchPending.deleteMany({
    where: { ...pendingWhereForUser(tenantId, userId), createdAt: { lt: cutoff } },
  });
}

export function parseTelecrmMobileDispatchBody(body: unknown):
  | Omit<TelecrmMobileDispatchItem, 'id' | 'createdAt'>
  | { error: string } {
  if (!body || typeof body !== 'object') return { error: '요청 본문이 필요합니다.' };
  const b = body as Record<string, unknown>;
  const actionRaw = typeof b.action === 'string' ? b.action.trim().toLowerCase() : '';
  if (actionRaw !== 'call' && actionRaw !== 'sms' && actionRaw !== 'prefill') {
    return { error: 'action은 call, sms, prefill 중 하나여야 합니다.' };
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

/** DB에 항상 적재 후 WS 즉시 전달 시도 (멀티 인스턴스·브라우저 WS 분리 대응) */
export async function enqueueTelecrmMobileDispatch(
  tenantId: string,
  actorUserId: string,
  actorRole: string,
  parsed: Omit<TelecrmMobileDispatchItem, 'id' | 'createdAt'>,
): Promise<{ item: TelecrmMobileDispatchItem; wsDelivered: boolean; queued: boolean; broadcastToTenant: boolean }> {
  const broadcastToTenant = actorRole === 'ADMIN';
  const item: TelecrmMobileDispatchItem = {
    ...parsed,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await prisma.telecrmMobileDispatchPending.create({
    data: {
      id: item.id,
      tenantId,
      userId: actorUserId,
      broadcastToTenant,
      action: item.action,
      phone: item.phone,
      body: item.body,
      imageUrl: item.imageUrl,
      inquiryId: item.inquiryId,
      customerMatch: item.customerMatch,
    },
  });

  const wsDelivered = deliverTelecrmDispatch(
    actorUserId,
    actorRole,
    dispatchWsPayload(item),
    tenantId,
  );

  return { item, wsDelivered, queued: true, broadcastToTenant };
}

export async function drainTelecrmMobileDispatchQueue(
  tenantId: string,
  userId: string,
): Promise<TelecrmMobileDispatchItem[]> {
  await pruneExpired(tenantId, userId);
  const rows = await prisma.telecrmMobileDispatchPending.findMany({
    where: pendingWhereForUser(tenantId, userId),
    orderBy: { createdAt: 'asc' },
    take: MAX_BATCH,
  });
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  await prisma.telecrmMobileDispatchPending.deleteMany({
    where: { tenantId, id: { in: ids } },
  });

  return rows.map(rowToItem);
}
