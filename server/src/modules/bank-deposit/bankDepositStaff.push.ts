import type { StaffAppPushPayload } from '../../lib/staffAppPush.helpers.js';
import { notifyStaffAppFcmRefresh } from '../push/staffAppPushNotify.js';
import {
  allowBankDepositPushTest,
  staffBankDepositPushTestItem,
  type StaffDepositPushItem,
} from './bankDepositStaffPush.logic.js';

type Sender = (items: StaffDepositPushItem[]) => Promise<void>;

async function sendWithStaffApp(items: StaffDepositPushItem[], skipKindPolicy = false): Promise<void> {
  if (items.length === 0) return;
  const tenantByUser = new Map<string, string>();
  const pushByUserId: Record<string, StaffAppPushPayload> = {};
  const userIds: string[] = [];
  for (const item of items) {
    if (!item.userId || !item.tenantId) continue;
    userIds.push(item.userId);
    tenantByUser.set(item.userId, item.tenantId);
    pushByUserId[item.userId] = {
      kind: 'bank_deposit',
      title: item.title,
      body: item.body,
      path: item.path,
    };
  }
  await notifyStaffAppFcmRefresh(userIds, tenantByUser, pushByUserId, { skipKindPolicy });
}

let sender: Sender = (items) => sendWithStaffApp(items, false);
let testSender: Sender = (items) => sendWithStaffApp(items, true);

/** 테스트에서 실제 휴대폰 알림 대신 기록만 하게 바꾼다. */
export function setBankDepositStaffPushSender(next: Sender | null): void {
  sender = next ?? ((items) => sendWithStaffApp(items, false));
  testSender = next ?? ((items) => sendWithStaffApp(items, true));
}

export async function pushBankDepositToStaff(items: StaffDepositPushItem[]): Promise<void> {
  await sender(items);
}

/** 관리자가 자기 자신에게만. 1분에 3번. */
export async function sendStaffBankDepositPushTest(
  userId: string,
  tenantId: string,
  nowMs = Date.now(),
): Promise<'ok' | 'rate'> {
  if (!allowBankDepositPushTest(userId, nowMs)) return 'rate';
  await testSender([staffBankDepositPushTestItem(userId, tenantId)]);
  return 'ok';
}
