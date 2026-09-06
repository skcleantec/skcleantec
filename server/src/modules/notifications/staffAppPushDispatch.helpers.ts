import { prisma } from '../../lib/prisma.js';
import {
  buildMessagePushPayload,
  type StaffAppPushPayload,
} from '../../lib/staffAppPush.helpers.js';

/** userId별 역할에 맞는 FCM payload 맵 (멀티테넌트·파트너 교차 알림) */
export async function buildPushByUserIdForUsers(
  userIds: string[],
  build: (role: string | null) => StaffAppPushPayload,
): Promise<Record<string, StaffAppPushPayload>> {
  const unique = [...new Set(userIds.filter((id) => id && !id.startsWith('crew:')))];
  if (unique.length === 0) return {};

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, role: true },
  });
  const roleById = new Map(users.map((u) => [u.id, u.role]));

  const out: Record<string, StaffAppPushPayload> = {};
  for (const id of unique) {
    out[id] = build(roleById.get(id) ?? null);
  }
  return out;
}

export async function notifyInboxRefreshWithPush(
  userIds: string[],
  build: (role: string | null) => StaffAppPushPayload,
): Promise<void> {
  const { notifyInboxRefresh } = await import('../realtime/inboxNotify.js');
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  const pushByUserId = await buildPushByUserIdForUsers(unique, build);
  notifyInboxRefresh(unique, pushByUserId);
}

/** 메시지·현장 공지 — 수신자에게만 미리보기 FCM, 보낸 사람은 화면 갱신만 */
export async function notifyMessageInboxRefresh(params: {
  senderId: string;
  senderName: string;
  senderRole: string | null | undefined;
  receiverIds: string[];
  messageId: string;
  preview: string;
  title?: string;
}): Promise<void> {
  const { notifyInboxRefresh } = await import('../realtime/inboxNotify.js');
  const uniqueReceivers = [
    ...new Set(params.receiverIds.filter((id) => id && id !== params.senderId)),
  ];
  const pushByUserId = await buildPushByUserIdForUsers(uniqueReceivers, (receiverRole) =>
    buildMessagePushPayload({
      senderName: params.senderName,
      senderRole: params.senderRole,
      receiverRole,
      senderUserId: params.senderId,
      messageId: params.messageId,
      preview: params.preview,
      title: params.title,
    }),
  );
  await notifyInboxRefresh([params.senderId, ...uniqueReceivers], pushByUserId);
}
