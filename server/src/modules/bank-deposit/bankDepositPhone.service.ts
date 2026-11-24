import { Prisma, type PrismaClient } from '@prisma/client';
import { loadPushFilterContext } from '../notifications/notificationPolicy.service.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { pushBankDepositToStaff } from './bankDepositStaff.push.js';
import { STAFF_BANK_DEPOSIT_PUSH_PATH, pickStaffBankDepositRecipients } from './bankDepositStaffPush.logic.js';
import {
  PHONE_ALERT_PUSH_TEXT,
  pickPhoneAlert,
  shouldSendPhoneAlert,
  type PhoneAlert,
  type PhoneDevice,
} from './bankDepositPhone.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

const deviceSelect = {
  id: true,
  createdAt: true,
  lastSeenAt: true,
  statusAt: true,
  listenerConnected: true,
  noticeAccessEnabled: true,
  keepAliveRunning: true,
  listenerDownSince: true,
  noticeOffSince: true,
  keepAliveOffSince: true,
  alertPushCode: true,
  alertPushAt: true,
} as const;

/** 연결된 폰의 문제. error 가 새로 생기면 관리자에게 한 시간당 한 번. */
export async function syncBankDepositPhoneAlert(db: Db, tenantId: string, now = new Date()): Promise<PhoneAlert | null> {
  const devices = await db.bankDepositDevice.findMany({
    where: { tenantId, isActive: true, revokedAt: null },
    select: deviceSelect,
  });
  const rows: PhoneDevice[] = devices.map((device) => ({
    ...device,
    listenerDownSince: device.listenerDownSince,
    noticeOffSince: device.noticeOffSince,
    keepAliveOffSince: device.keepAliveOffSince,
  }));
  const picked = pickPhoneAlert(rows, now);
  if (!picked.alert || !picked.deviceId || !shouldSendPhoneAlert(rows, picked.alert, now)) return picked.alert;
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const claimed = await db.bankDepositDevice.updateMany({
    where: {
      id: picked.deviceId,
      tenantId,
      OR: [
        { alertPushAt: null },
        { alertPushCode: { not: picked.alert.code } },
        { alertPushAt: { lt: hourAgo } },
      ],
    },
    data: { alertPushCode: picked.alert.code, alertPushAt: now },
  });
  if (claimed.count !== 1) return picked.alert;
  try {
    await pushPhoneAlertToAdmins(db, tenantId);
  } catch {
    console.warn('[bank-deposit] phone alert push skipped');
  }
  return picked.alert;
}

async function pushPhoneAlertToAdmins(db: Db, tenantId: string): Promise<void> {
  const today = kstTodayYmd();
  const users = await db.user.findMany({
    where: { tenantId, isActive: true, role: 'ADMIN' },
    select: { id: true, role: true, hireDate: true, resignationDate: true },
  });
  const candidates = users.map((user) => ({
    id: user.id,
    role: user.role,
    isActive: true,
    employed: isUserEmployedOnYmd(user.hireDate, user.resignationDate, today),
  }));
  const ctx = await loadPushFilterContext(
    tenantId,
    candidates.map((user) => user.id),
  );
  const prefs = new Map(candidates.map((user) => [user.id, ctx.userPrefsById.get(user.id) ?? null] as const));
  const userIds = pickStaffBankDepositRecipients(candidates, ctx.tenantPolicy, prefs);
  await pushBankDepositToStaff(
    userIds.map((userId) => ({
      userId,
      tenantId,
      title: PHONE_ALERT_PUSH_TEXT,
      body: PHONE_ALERT_PUSH_TEXT,
      path: STAFF_BANK_DEPOSIT_PUSH_PATH,
    })),
  );
}

export function countersForDevice(value: Prisma.JsonValue | null): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, number>;
}
