import webpush from 'web-push';
import { prisma } from '../../lib/prisma.js';
import { getWebPushSubject, getVapidPublicKey, isWebPushConfigured } from './webPushConfig.js';

let vapidApplied = false;

function ensureVapidDetails(): boolean {
  if (!isWebPushConfigured()) return false;
  if (vapidApplied) return true;
  webpush.setVapidDetails(getWebPushSubject(), getVapidPublicKey(), process.env.WEBPUSH_VAPID_PRIVATE_KEY!.trim());
  vapidApplied = true;
  return true;
}

export type WebPushPayload = { title: string; body: string; url: string };

/** 구독이 만료·무효면 DB에서 삭제 */
export async function sendWebPushToUserIds(userIds: string[], payload: WebPushPayload): Promise<void> {
  if (!ensureVapidDetails() || userIds.length === 0) return;
  const unique = [...new Set(userIds)];
  const subs = await prisma.teamLeaderWebPushSubscription.findMany({
    where: { userId: { in: unique } },
  });
  if (subs.length === 0) return;
  const data = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
        { TTL: 3600 }
      );
    } catch (e: unknown) {
      const status =
        typeof e === 'object' && e !== null && 'statusCode' in e ? (e as { statusCode: number }).statusCode : 0;
      if (status === 410 || status === 404) {
        await prisma.teamLeaderWebPushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.error('[web-push] send failed', status, e);
      }
    }
  }
}
