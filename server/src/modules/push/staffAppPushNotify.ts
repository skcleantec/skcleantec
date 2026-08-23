import { prisma } from '../../lib/prisma.js';
import { CBISEO_STAFF_APP_PACKAGE } from '../../lib/cbiseoStaffAppPolicy.constants.js';

/** Firebase Admin 미설정 시 false — WS만 사용 */
export function isStaffAppFcmConfigured(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  return Boolean(raw && raw.startsWith('{'));
}

/**
 * `notifyInboxRefresh`와 병행 — 등록된 FCM 토큰으로 data push (Phase 3: firebase-admin 연동).
 * 현재: env 미설정 시 no-op.
 */
export async function notifyStaffAppFcmRefresh(
  userIds: string[],
  tenantByUser: Map<string, string | undefined>,
): Promise<void> {
  if (!isStaffAppFcmConfigured()) return;

  const seen = new Set<string>();
  const pairs: { userId: string; tenantId: string }[] = [];
  for (const id of userIds) {
    if (!id || seen.has(id) || id.startsWith('crew:')) continue;
    seen.add(id);
    const tenantId = tenantByUser.get(id);
    if (!tenantId) continue;
    pairs.push({ userId: id, tenantId });
  }
  if (pairs.length === 0) return;

  const userIdSet = pairs.map((p) => p.userId);
  const tokens = await prisma.staffAppFcmToken.findMany({
    where: {
      userId: { in: userIdSet },
      appId: CBISEO_STAFF_APP_PACKAGE,
    },
    select: { token: true, userId: true, tenantId: true },
  });

  if (tokens.length === 0) return;

  // Phase 3: firebase-admin messaging.sendEachForMulticast
  // payload: { data: { type: 'inbox:refresh' } }
  void tokens;
}
