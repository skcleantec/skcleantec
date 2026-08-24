import { prisma } from '../../lib/prisma.js';
import type { StaffAppPushPayload } from '../../lib/staffAppPush.helpers.js';
import { sendJsonToUser } from './realtimeHub.js';
import { notifyStaffAppFcmRefresh } from '../push/staffAppPushNotify.js';

/** 메시지함 갱신 — 클라이언트가 GET으로 다시 불러오도록 신호만 보냄 */
export async function notifyInboxRefresh(
  userIds: string[],
  pushByUserId?: Record<string, StaffAppPushPayload>,
): Promise<void> {
  const seen = new Set<string>();
  const regularIds: string[] = [];
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (id.startsWith('crew:')) {
      sendJsonToUser(id, { type: 'inbox:refresh' });
    } else {
      regularIds.push(id);
    }
  }
  if (regularIds.length === 0) return;

  const rows = await prisma.user.findMany({
    where: { id: { in: regularIds } },
    select: { id: true, tenantId: true },
  });
  const tenantByUser = new Map(rows.map((r) => [r.id, r.tenantId]));
  for (const id of regularIds) {
    sendJsonToUser(id, { type: 'inbox:refresh' }, tenantByUser.get(id));
  }
  void notifyStaffAppFcmRefresh(regularIds, tenantByUser, pushByUserId);
}
