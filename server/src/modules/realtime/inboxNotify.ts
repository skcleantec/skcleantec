import { prisma } from '../../lib/prisma.js';
import type { StaffAppPushPayload } from '../../lib/staffAppPush.helpers.js';
import { sendJsonToUser } from './realtimeHub.js';
import { notifyStaffAppFcmRefresh } from '../push/staffAppPushNotify.js';

/**
 * 메시지함 갱신 — 웹소켓 `inbox:refresh`는 항상 보냄.
 * 휴대폰 FCM은 `pushByUserId`에 **내용 있는 페이로드가 있는 사용자만**.
 */
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
  await notifyStaffAppFcmRefresh(regularIds, tenantByUser, pushByUserId);
}

/** 플랜·기능이 바뀌면 관리·마케터 화면에 /auth/me 를 다시 읽게 한다. 휴대폰 푸시는 보내지 않는다. */
export async function notifyTenantCapabilitiesRefresh(tenantId: string): Promise<void> {
  const rows = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true },
  });
  for (const row of rows) {
    sendJsonToUser(row.id, { type: 'tenant:capabilities' }, tenantId);
  }
}
