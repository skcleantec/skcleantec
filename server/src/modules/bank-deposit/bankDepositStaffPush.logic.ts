import {
  shouldSendPushToUser,
  type TenantNotificationPolicyDto,
  type UserNotificationPreferencesDto,
} from '../../lib/notificationPolicy.helpers.js';

export const STAFF_BANK_DEPOSIT_PUSH_PATH = '/admin/inquiries/deposits';

const DAY_MS = 24 * 60 * 60 * 1000;

const KIND_WORD: Record<string, string> = {
  DEPOSIT: '계약금',
  BALANCE: '잔금',
  TOTAL: '총액',
};

export type StaffBankDepositPushInput = {
  event: 'new' | 'changed';
  source: string;
  depositedAt: Date;
  now: Date;
  featureOn: boolean;
  status: string;
  amountWon: number;
  depositorName: string;
  brandName: string | null;
  customerName: string | null;
  marketerName: string | null;
  linkedKind: string | null;
};

export type StaffPushCandidate = {
  id: string;
  role: string;
  isActive: boolean;
  employed: boolean;
};

export type StaffDepositPushItem = {
  userId: string;
  tenantId: string;
  title: string;
  body: string;
  path: string;
};

/** 새 입금 한 건만. 직접 추가·24시간보다 오래된 것·기능이 꺼진 업체는 제외. */
export function shouldNotifyStaffOfNewDeposit(input: {
  event: 'new' | 'changed';
  source: string;
  depositedAt: Date;
  now: Date;
  featureOn: boolean;
}): boolean {
  if (!input.featureOn) return false;
  if (input.event !== 'new') return false;
  if (input.source === 'manual') return false;
  if (input.now.getTime() - input.depositedAt.getTime() > DAY_MS) return false;
  return true;
}

export function staffBankDepositPushCopy(input: {
  status: string;
  amountWon: number;
  depositorName: string;
  brandName: string | null;
  customerName: string | null;
  marketerName: string | null;
  linkedKind: string | null;
}): { title: string; body: string; path: string } {
  const title = `입금 ${input.amountWon.toLocaleString('ko-KR')}원 · ${input.depositorName.trim()}`;
  const path = STAFF_BANK_DEPOSIT_PUSH_PATH;
  if (input.status !== 'AUTO_LINKED') {
    const brand = input.brandName?.trim();
    return {
      title,
      body: brand ? `${brand} · 누구 입금인지 확인 필요` : '누구 입금인지 확인 필요',
      path,
    };
  }
  const parts: string[] = [];
  const customer = input.customerName?.trim() ?? '';
  if (customer && customer !== input.depositorName.trim()) parts.push(`${customer} 고객`);
  const brand = input.brandName?.trim();
  if (brand) parts.push(brand);
  const kindWord = input.linkedKind ? KIND_WORD[input.linkedKind] : undefined;
  if (kindWord) parts.push(kindWord);
  const marketer = input.marketerName?.trim();
  if (marketer) parts.push(`담당 ${marketer}`);
  return { title, body: parts.join(' · '), path };
}

/** 재직 중 관리자·마케터. 업체 정책이 꺼져 있거나 본인이 끈 사람은 빠진다. */
export function pickStaffBankDepositRecipients(
  users: StaffPushCandidate[],
  policy: TenantNotificationPolicyDto,
  prefs: Map<string, UserNotificationPreferencesDto | null>,
): string[] {
  return users
    .filter((user) => user.isActive && user.employed && (user.role === 'ADMIN' || user.role === 'MARKETER'))
    .filter((user) => shouldSendPushToUser('bank_deposit', policy, prefs.get(user.id) ?? null))
    .map((user) => user.id);
}

const pushTestHits = new Map<string, number[]>();

export function resetBankDepositPushTestWindow(): void {
  pushTestHits.clear();
}

/** 시험 알림은 같은 사람에게 1분에 3번. */
export function allowBankDepositPushTest(userId: string, nowMs: number): boolean {
  const recent = (pushTestHits.get(userId) ?? []).filter((at) => nowMs - at < 60_000);
  if (recent.length >= 3) {
    pushTestHits.set(userId, recent);
    return false;
  }
  recent.push(nowMs);
  pushTestHits.set(userId, recent);
  return true;
}

export function staffBankDepositPushTestItem(userId: string, tenantId: string): StaffDepositPushItem {
  return {
    userId,
    tenantId,
    title: '입금 10원 · 시험',
    body: '입금 알림 시험입니다',
    path: STAFF_BANK_DEPOSIT_PUSH_PATH,
  };
}

export async function runStaffBankDepositPush(
  input: StaffBankDepositPushInput & { tenantId: string },
  deps: {
    claim: () => Promise<boolean>;
    loadUsers: () => Promise<StaffPushCandidate[]>;
    loadPolicy: () => Promise<{
      policy: TenantNotificationPolicyDto;
      prefs: Map<string, UserNotificationPreferencesDto | null>;
    }>;
    send: (items: StaffDepositPushItem[]) => Promise<void>;
  },
): Promise<'skip' | 'duplicate' | 'sent' | 'failed'> {
  if (!shouldNotifyStaffOfNewDeposit(input)) return 'skip';
  const won = await deps.claim();
  if (!won) return 'duplicate';
  try {
    const users = await deps.loadUsers();
    const { policy, prefs } = await deps.loadPolicy();
    const userIds = pickStaffBankDepositRecipients(users, policy, prefs);
    if (userIds.length === 0) return 'sent';
    const copy = staffBankDepositPushCopy(input);
    await deps.send(
      userIds.map((userId) => ({
        userId,
        tenantId: input.tenantId,
        title: copy.title,
        body: copy.body,
        path: copy.path,
      })),
    );
    return 'sent';
  } catch {
    return 'failed';
  }
}
