import { prisma } from '../../lib/prisma.js';
import { CBISEO_STAFF_APP_PACKAGE } from '../../lib/cbiseoStaffAppPolicy.constants.js';
import {
  buildGenericStaffAppPushPayload,
  staffAppPushDataRecord,
  type StaffAppPushPayload,
} from '../../lib/staffAppPush.helpers.js';
import {
  shouldSendPushToUser,
  type StaffAppPushKind,
} from '../../lib/notificationPolicy.helpers.js';
import { getStaffAppFcmMessaging } from './staffAppFcm.admin.js';
import { loadPushFilterContext } from '../notifications/notificationPolicy.service.js';

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
 * 테넌트·사용자 알림 설정을 반영해 skip.
 */
export async function notifyStaffAppFcmRefresh(
  userIds: string[],
  tenantByUser: Map<string, string | undefined>,
  pushByUserId?: Record<string, StaffAppPushPayload>,
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

  const generic = buildGenericStaffAppPushPayload();
  const staleTokenValues: string[] = [];

  const tokensByTenant = new Map<string, typeof tokens>();
  for (const row of tokens) {
    const list = tokensByTenant.get(row.tenantId) ?? [];
    list.push(row);
    tokensByTenant.set(row.tenantId, list);
  }

  for (const [tenantId, tenantTokens] of tokensByTenant) {
    const filterCtx = await loadPushFilterContext(
      tenantId,
      tenantTokens.map((t) => t.userId),
    );

    for (const chunk of chunkArray(tenantTokens, 500)) {
      const messages: Array<{ token: string; data: Record<string, string> }> = [];

      for (const row of chunk) {
        const payload = pushByUserId?.[row.userId] ?? generic;
        const kind = (payload.kind ?? 'generic') as StaffAppPushKind;
        const userPref = filterCtx.userPrefsById.get(row.userId) ?? null;
        if (!shouldSendPushToUser(kind, filterCtx.tenantPolicy, userPref)) continue;
        messages.push({
          token: row.token,
          data: staffAppPushDataRecord(payload),
        });
      }

      if (messages.length === 0) continue;

      const response = await fcm.sendEach(
        messages.map((m) => ({
          token: m.token,
          data: m.data,
          android: { priority: 'high' as const },
        })),
      );

      response.responses.forEach((res, idx) => {
        if (res.success) return;
        const code = res.error?.code;
        if (code && STALE_FCM_ERROR_CODES.has(code)) {
          staleTokenValues.push(chunk[idx]!.token);
        }
      });
    }
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
