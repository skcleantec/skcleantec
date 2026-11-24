import { Prisma, type PrismaClient } from '@prisma/client';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { loadPushFilterContext } from '../notifications/notificationPolicy.service.js';
import { kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { pushBankDepositToStaff } from './bankDepositStaff.push.js';
import {
  runStaffBankDepositPush,
  type StaffBankDepositPushInput,
  type StaffPushCandidate,
} from './bankDepositStaffPush.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** 새 입금 저장 직후. 실패해도 입금 저장은 그대로 둔다. 선점한 뒤에는 다시 보내지 않는다. */
export async function notifyStaffOfNewBankDeposit(
  db: Db,
  input: Omit<StaffBankDepositPushInput, 'featureOn' | 'now'> & { tenantId: string; depositId: string },
): Promise<void> {
  try {
    const featureOn = await isFeatureEnabled(input.tenantId, 'mod_bank_deposit');
    const today = kstTodayYmd();
    let loaded: StaffPushCandidate[] | null = null;
    const loadStaff = async () => {
      if (loaded) return loaded;
      const users = await db.user.findMany({
        where: { tenantId: input.tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
        select: { id: true, role: true, hireDate: true, resignationDate: true },
      });
      loaded = users.map((user) => ({
        id: user.id,
        role: user.role,
        isActive: true,
        employed: isUserEmployedOnYmd(user.hireDate, user.resignationDate, today),
      }));
      return loaded;
    };
    await runStaffBankDepositPush(
      { ...input, featureOn, now: new Date() },
      {
        claim: async () => {
          const claimed = await db.bankDeposit.updateMany({
            where: { id: input.depositId, tenantId: input.tenantId, staffPushClaimedAt: null },
            data: { staffPushClaimedAt: new Date() },
          });
          return claimed.count === 1;
        },
        loadUsers: loadStaff,
        loadPolicy: async () => {
          const users = await loadStaff();
          const ctx = await loadPushFilterContext(
            input.tenantId,
            users.map((user) => user.id),
          );
          const prefs = new Map(users.map((user) => [user.id, ctx.userPrefsById.get(user.id) ?? null] as const));
          return { policy: ctx.tenantPolicy, prefs };
        },
        send: (items) => pushBankDepositToStaff(items),
      },
    );
  } catch {
    console.warn('[bank-deposit] staff push skipped');
  }
}
