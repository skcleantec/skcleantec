import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankDepositFeatureDisabledBody } from './bankDepositGuard.js';
import {
  buildTeamNotificationSettingsView,
  companyNotificationKinds,
  defaultTenantNotificationPolicy,
  mergeTenantNotificationPolicy,
  type TenantNotificationPolicyDto,
  type UserNotificationPreferencesDto,
} from '../../lib/notificationPolicy.helpers.js';
import { setBankDepositStaffPushSender } from './bankDepositStaff.push.js';
import { sendStaffBankDepositPushTest } from './bankDepositStaff.push.js';
import {
  allowBankDepositPushTest,
  pickStaffBankDepositRecipients,
  resetBankDepositPushTestWindow,
  runStaffBankDepositPush,
  shouldNotifyStaffOfNewDeposit,
  staffBankDepositPushCopy,
  staffBankDepositPushTestItem,
  type StaffBankDepositPushInput,
  type StaffDepositPushItem,
  type StaffPushCandidate,
} from './bankDepositStaffPush.logic.js';

const now = new Date('2026-11-24T06:00:00.000Z');
const fresh = new Date(now.getTime() - 60 * 60 * 1000);
const old = new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1);
const exactly = new Date(now.getTime() - 24 * 60 * 60 * 1000);

function policy(enabled = true): TenantNotificationPolicyDto {
  const next = defaultTenantNotificationPolicy();
  next.kinds.bank_deposit = { ...next.kinds.bank_deposit, enabled };
  return next;
}

function prefs(id: string, push: boolean): Map<string, UserNotificationPreferencesDto | null> {
  return new Map([[id, { kinds: { bank_deposit: { push } } }]]);
}

const base: StaffBankDepositPushInput = {
  event: 'new',
  source: 'sms',
  depositedAt: fresh,
  now,
  featureOn: true,
  status: 'AUTO_LINKED',
  amountWon: 20000,
  depositorName: '김입금',
  brandName: '클린브랜드',
  customerName: '김입금',
  marketerName: '박담당',
  linkedKind: 'DEPOSIT',
};

describe('입금 업무 앱 알림', () => {
  it('저장된 정책에 종류가 없어도 기본값으로 읽힌다', () => {
    const merged = mergeTenantNotificationPolicy({
      kinds: { assignment: { enabled: true, mandatory: true } },
    });
    assert.equal(merged.kinds.bank_deposit.enabled, true);
    assert.equal(merged.kinds.bank_deposit.mandatory, false);
    assert.equal(merged.kinds.bank_deposit.defaultPush, true);
    assert.equal(merged.kinds.bank_deposit.repeatEnabled, false);
  });

  it('입금 확인을 켜지 않은 업체와 팀장 설정에는 종류가 없다', () => {
    assert.equal(companyNotificationKinds(false).includes('bank_deposit'), false);
    assert.equal(companyNotificationKinds(true).includes('bank_deposit'), true);
    const view = buildTeamNotificationSettingsView(policy(true), { kinds: {} });
    assert.equal(view.some((item) => item.kind === 'bank_deposit'), false);
    const staff = buildTeamNotificationSettingsView(policy(true), { kinds: {} }, { includeBankDeposit: true });
    const row = staff.find((item) => item.kind === 'bank_deposit');
    assert.equal(row?.label, '입금 알림');
    assert.equal(row?.description, '통장에 입금이 들어올 때 한 번. 관리자·마케터 모두에게 갑니다');
    assert.equal(row?.canToggle, true);
    assert.equal(
      buildTeamNotificationSettingsView(policy(false), { kinds: {} }, { includeBankDeposit: true }).some(
        (item) => item.kind === 'bank_deposit',
      ),
      false,
    );
    assert.equal(bankDepositFeatureDisabledBody().code, 'feature_disabled');
  });

  it('새 입금만 보내고 직접 추가·오래된 입금·변경은 보내지 않는다', () => {
    assert.equal(shouldNotifyStaffOfNewDeposit(base), true);
    assert.equal(shouldNotifyStaffOfNewDeposit({ ...base, event: 'changed' }), false);
    assert.equal(shouldNotifyStaffOfNewDeposit({ ...base, source: 'manual' }), false);
    assert.equal(shouldNotifyStaffOfNewDeposit({ ...base, source: 'scan', depositedAt: old }), false);
    assert.equal(shouldNotifyStaffOfNewDeposit({ ...base, depositedAt: exactly }), true);
    assert.equal(shouldNotifyStaffOfNewDeposit({ ...base, featureOn: false }), false);
  });

  it('관리자·마케터만, 정책과 개인 설정이 켜진 사람만 고른다', () => {
    const users: StaffPushCandidate[] = [
      { id: 'admin', role: 'ADMIN', isActive: true, employed: true },
      { id: 'marketer', role: 'MARKETER', isActive: true, employed: true },
      { id: 'leader', role: 'TEAM_LEADER', isActive: true, employed: true },
      { id: 'office', role: 'OFFICE_STAFF', isActive: true, employed: true },
      { id: 'off', role: 'ADMIN', isActive: false, employed: true },
      { id: 'left', role: 'MARKETER', isActive: true, employed: false },
      { id: 'muted', role: 'MARKETER', isActive: true, employed: true },
    ];
    const chosen = pickStaffBankDepositRecipients(users, policy(true), prefs('muted', false));
    assert.deepEqual(chosen, ['admin', 'marketer']);
    assert.deepEqual(pickStaffBankDepositRecipients(users, policy(false), new Map()), []);
  });

  it('자동 연결과 확인 필요 문구를 조립한다', () => {
    const linked = staffBankDepositPushCopy(base);
    assert.equal(linked.title, '입금 20,000원 · 김입금');
    assert.equal(linked.body, '클린브랜드 · 계약금 · 담당 박담당');
    assert.equal(linked.path, '/admin/inquiries/deposits');
    assert.equal(
      staffBankDepositPushCopy({ ...base, customerName: '이고객', linkedKind: 'BALANCE', amountWon: 330000 }).body,
      '이고객 고객 · 클린브랜드 · 잔금 · 담당 박담당',
    );
    assert.equal(
      staffBankDepositPushCopy({ ...base, marketerName: null, linkedKind: 'TOTAL' }).body,
      '클린브랜드 · 총액',
    );
    assert.equal(
      staffBankDepositPushCopy({ ...base, brandName: null, marketerName: null }).body,
      '계약금',
    );
    const review = staffBankDepositPushCopy({
      ...base,
      status: 'NEEDS_REVIEW',
      amountWon: 330000,
      depositorName: '최입금',
      linkedKind: null,
    });
    assert.equal(review.title, '입금 330,000원 · 최입금');
    assert.equal(review.body, '클린브랜드 · 누구 입금인지 확인 필요');
    assert.equal(
      staffBankDepositPushCopy({ ...base, status: 'NEEDS_REVIEW', brandName: '  ' }).body,
      '누구 입금인지 확인 필요',
    );
  });

  it('같은 입금은 한 번만 보내고, 보내는 중 실패해도 예외를 올리지 않는다', async () => {
    const sent: StaffDepositPushItem[][] = [];
    let claimed = false;
    const deps = {
      claim: async () => {
        if (claimed) return false;
        claimed = true;
        return true;
      },
      loadUsers: async () => [{ id: 'admin', role: 'ADMIN', isActive: true, employed: true }],
      loadPolicy: async () => ({ policy: policy(true), prefs: new Map() }),
      send: async (items: StaffDepositPushItem[]) => {
        sent.push(items);
      },
    };
    assert.equal(await runStaffBankDepositPush({ ...base, tenantId: 't1' }, deps), 'sent');
    assert.equal(await runStaffBankDepositPush({ ...base, tenantId: 't1' }, deps), 'duplicate');
    assert.equal(sent.length, 1);
    assert.deepEqual(
      sent[0]?.map((item) => item.userId),
      ['admin'],
    );
    assert.equal(
      await runStaffBankDepositPush(
        { ...base, tenantId: 't1', featureOn: false },
        { ...deps, claim: async () => { throw new Error('claim'); } },
      ),
      'skip',
    );
    claimed = false;
    assert.equal(
      await runStaffBankDepositPush(
        { ...base, tenantId: 't1' },
        { ...deps, send: async () => { throw new Error('fcm'); } },
      ),
      'failed',
    );
  });

  it('시험 알림은 요청한 사람에게만, 1분에 3번까지', async () => {
    resetBankDepositPushTestWindow();
    const seen: StaffDepositPushItem[] = [];
    setBankDepositStaffPushSender(async (items) => {
      seen.push(...items);
    });
    try {
      const at = 1_700_000_000_000;
      assert.equal(await sendStaffBankDepositPushTest('me', 'tenant-a', at), 'ok');
      assert.equal(await sendStaffBankDepositPushTest('me', 'tenant-a', at + 1), 'ok');
      assert.equal(await sendStaffBankDepositPushTest('me', 'tenant-a', at + 2), 'ok');
      assert.equal(await sendStaffBankDepositPushTest('me', 'tenant-a', at + 3), 'rate');
      assert.equal(await sendStaffBankDepositPushTest('other', 'tenant-a', at + 3), 'ok');
      assert.equal(allowBankDepositPushTest('me', at + 60_000), true);
      assert.deepEqual(
        seen.map((item) => item.userId),
        ['me', 'me', 'me', 'other'],
      );
      assert.equal(seen.every((item) => item.tenantId === 'tenant-a'), true);
      const sample = staffBankDepositPushTestItem('me', 'tenant-a');
      assert.equal(sample.title, '입금 10원 · 시험');
      assert.equal(sample.body, '입금 알림 시험입니다');
      assert.equal(sample.path, '/admin/inquiries/deposits');
      assert.equal(seen[0]?.title, sample.title);
    } finally {
      setBankDepositStaffPushSender(null);
      resetBankDepositPushTestWindow();
    }
  });
});
