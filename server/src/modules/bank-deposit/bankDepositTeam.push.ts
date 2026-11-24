import { notifyStaffAppFcmRefresh } from '../push/staffAppPushNotify.js';
import type { StaffAppPushPayload } from '../../lib/staffAppPush.helpers.js';

export type TeamDepositPush = {
  userId: string;
  tenantId: string;
  title: string;
  body: string;
  path: string;
};

type Sender = (items: TeamDepositPush[]) => Promise<void>;

async function sendWithStaffApp(items: TeamDepositPush[]): Promise<void> {
  if (items.length === 0) return;
  const tenantByUser = new Map<string, string>();
  const pushByUserId: Record<string, StaffAppPushPayload> = {};
  const userIds: string[] = [];
  for (const item of items) {
    if (!item.userId || !item.tenantId) continue;
    userIds.push(item.userId);
    tenantByUser.set(item.userId, item.tenantId);
    pushByUserId[item.userId] = {
      kind: 'schedule_alert',
      title: item.title,
      body: item.body,
      path: item.path,
    };
  }
  await notifyStaffAppFcmRefresh(userIds, tenantByUser, pushByUserId);
}

let sender: Sender = sendWithStaffApp;

/** 테스트에서 실제 휴대폰 알림 대신 기록만 하게 바꾼다. */
export function setBankDepositTeamPushSender(next: Sender | null): void {
  sender = next ?? sendWithStaffApp;
}

export async function pushBankDepositToLeaders(items: TeamDepositPush[]): Promise<void> {
  await sender(items);
}
