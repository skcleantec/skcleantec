import { prisma } from '../../lib/prisma.js';
import { CBISEO_STAFF_APP_PACKAGE } from '../../lib/cbiseoStaffAppPolicy.constants.js';
import { getStaffAppFcmMessaging } from './staffAppFcm.admin.js';

/** Firebase Admin 미설정 시 false — WS만 사용 */
export function isStaffAppFcmConfigured(): boolean {
  return getStaffAppFcmMessaging() != null;
}

const STALE_FCM_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * `notifyInboxRefresh`와 병행 — 등록된 FCM 토큰으로 알림 (앱 백그라운드).
 * 포그라운드는 WebView `cbiseo:inbox-refresh` + WS와 동일하게 silent refetch.
 */
export async function notifyStaffAppFcmRefresh(
  userIds: string[],
  tenantByUser: Map<string, string | undefined>,
): Promise<void> {
  const fcm = getStaffAppFcmMessaging();
  if (!fcm) return;

  const seen = new Set<string>();
  const allowedUserIds = new Set<string>();
  for (const id of userIds) {
    if (!id || seen.has(id) || id.startsWith('crew:')) continue;
    seen.add(id);
    if (!tenantByUser.get(id)) continue;
    allowedUserIds.add(id);
  }
  if (allowedUserIds.size === 0) return;

  const tokens = await prisma.staffAppFcmToken.findMany({
    where: {
      userId: { in: [...allowedUserIds] },
      appId: CBISEO_STAFF_APP_PACKAGE,
    },
    select: { id: true, token: true, userId: true, tenantId: true },
  });

  if (tokens.length === 0) return;

  const staleTokenValues: string[] = [];

  for (const chunk of chunkArray(tokens, 500)) {
    const response = await fcm.sendEachForMulticast({
      tokens: chunk.map((t) => t.token),
      notification: {
        title: '청소비서',
        body: '새 알림이 있습니다. 탭하여 확인하세요.',
      },
      data: {
        type: 'inbox:refresh',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'cbiseo_staff_default',
          clickAction: 'OPEN_STAFF_APP',
        },
      },
    });

    response.responses.forEach((res, idx) => {
      if (res.success) return;
      const code = res.error?.code;
      if (code && STALE_FCM_ERROR_CODES.has(code)) {
        staleTokenValues.push(chunk[idx]!.token);
      }
    });
  }

  if (staleTokenValues.length > 0) {
    await prisma.staffAppFcmToken.deleteMany({
      where: { token: { in: staleTokenValues } },
    });
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
