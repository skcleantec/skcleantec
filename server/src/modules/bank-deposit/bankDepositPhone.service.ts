import { Prisma, type PrismaClient } from '@prisma/client';
import { loadPushFilterContext } from '../notifications/notificationPolicy.service.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { pushBankDepositToStaff } from './bankDepositStaff.push.js';
import { STAFF_BANK_DEPOSIT_PUSH_PATH, pickStaffBankDepositRecipients } from './bankDepositStaffPush.logic.js';
import {
  PHONE_ALERT_PUSH_TEXT,
  PHONE_ALERT_RESTORED_TEXT,
  phoneAlertTick,
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
  alertRecoveredAt: true,
} as const;

/** 연결된 폰의 문제. error 가 새로 생기면 관리자에게 한 시간당 한 번. 풀리면 한 번 더. */
export async function syncBankDepositPhoneAlert(db: Db, tenantId: string, now = new Date()): Promise<PhoneAlert | null> {
  const devices = await db.bankDepositDevice.findMany({
    where: { tenantId, isActive: true, revokedAt: null },
    select: deviceSelect,
  });
  const rows: PhoneDevice[] = devices.map((device) => ({ ...device }));
  const tick = phoneAlertTick(rows, now);
  if (tick.sendError && tick.deviceId && tick.alert) {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const claimed = await db.bankDepositDevice.updateMany({
      where: {
        id: tick.deviceId,
        tenantId,
        OR: [
          { alertPushAt: null },
          { alertPushCode: { not: tick.alert.code } },
          { alertPushAt: { lt: hourAgo } },
        ],
      },
      data: { alertPushCode: tick.alert.code, alertPushAt: now, alertRecoveredAt: null },
    });
    if (claimed.count === 1) {
      try {
        await pushPhoneAlertToAdmins(db, tenantId, PHONE_ALERT_PUSH_TEXT);
      } catch {
        console.warn('[bank-deposit] phone alert push skipped');
      }
    }
  } else if (tick.recoverDeviceId) {
    const claimed = await db.bankDepositDevice.updateMany({
      where: {
        id: tick.recoverDeviceId,
        tenantId,
        alertRecoveredAt: null,
        alertPushAt: { not: null },
        alertPushCode: { in: ['NOT_LISTENING', 'NO_ACCESS', 'SILENT'] },
      },
      data: { alertRecoveredAt: now },
    });
    if (claimed.count === 1) {
      try {
        await pushPhoneAlertToAdmins(db, tenantId, PHONE_ALERT_RESTORED_TEXT);
      } catch {
        console.warn('[bank-deposit] phone alert push skipped');
      }
    }
  }
  return tick.alert;
}

let watchTimer: ReturnType<typeof setInterval> | null = null;

/** 1분마다. 화면을 열지 않아도 끊긴 폰을 본다. 선점 기록으로 인스턴스가 겹쳐도 한 번만 보낸다. */
export function startBankDepositPhoneAlertWatch(db: PrismaClient): void {
  if (watchTimer) return;
  const tick = () => {
    void watchBankDepositPhoneAlerts(db).catch(() => {
      console.warn('[bank-deposit] phone alert watch skipped');
    });
  };
  watchTimer = setInterval(tick, 60 * 1000);
  watchTimer.unref();
}

async function watchBankDepositPhoneAlerts(db: PrismaClient): Promise<void> {
  const links = await db.bankDepositDevice.findMany({
    where: { isActive: true, revokedAt: null },
    distinct: ['tenantId'],
    select: { tenantId: true },
  });
  for (const link of links) {
    if (!(await isFeatureEnabled(link.tenantId, 'mod_bank_deposit'))) continue;
    try {
      await syncBankDepositPhoneAlert(db, link.tenantId);
    } catch {
      console.warn('[bank-deposit] phone alert skipped');
    }
  }
}

async function pushPhoneAlertToAdmins(db: Db, tenantId: string, text: string): Promise<void> {
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
      title: text,
      body: text,
      path: STAFF_BANK_DEPOSIT_PUSH_PATH,
    })),
  );
}

export function countersForDevice(value: Prisma.JsonValue | null): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, number>;
}
