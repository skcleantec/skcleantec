import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchBankDeposit } from './bankDepositMatch.js';
import { setBankDepositTeamPushSender, pushBankDepositToLeaders } from './bankDepositTeam.push.js';
import {
  allLeadersDeclined,
  balancePushBody,
  canRemindOpenDeposit,
  claimDecision,
  contractDepositAmounts,
  customerBalanceWon,
  isOpenBalanceDeposit,
  notifiesTeamLeader,
  openPushBody,
  orderFormDepositorNames,
  soleByNameAndAmount,
} from './bankDepositTeam.logic.js';
import { sameTenant } from './bankDepositGuard.js';
import { bankDepositFeatureStatus } from './bankDepositView.js';

const inquiry = {
  id: 'inq-1',
  customerName: '김고객',
  nickname: null,
  depositWon: 20000,
  balanceWon: 230000,
  totalWon: 250000,
  orderDepositWon: null,
  orderBalanceWon: null,
  orderTotalWon: null,
  blockedKinds: [] as const,
};

describe('발주서 제출 뒤 다시 맞추기', () => {
  it('입금자 칸 이름과 금액이 그 접수 하나뿐이면 연결한다', () => {
    const matched = matchBankDeposit({
      depositorName: '홍길동',
      amountWon: 230000,
      inquiries: [{ ...inquiry, extraNames: ['홍길동'] }],
      followups: [],
    });
    assert.equal(matched.auto?.id, 'inq-1');
    assert.equal(matched.auto?.kind, 'BALANCE');
  });

  it('같은 조건 후보가 둘이면 연결하지 않는다', () => {
    const matched = matchBankDeposit({
      depositorName: '홍길동',
      amountWon: 230000,
      inquiries: [
        { ...inquiry, extraNames: ['홍길동'] },
        { ...inquiry, id: 'inq-2', extraNames: ['홍길동'] },
      ],
      followups: [],
    });
    assert.equal(matched.auto, null);
    assert.equal(matched.candidates.length, 2);
  });

  it('발주서 질문 중 입금자 칸의 답만 이름으로 쓴다', () => {
    const names = orderFormDepositorNames(
      [
        { fieldKey: 'payer', label: '입금자명' },
        { fieldKey: 'note', label: '특이사항' },
      ],
      [{ payer: ' 홍길동 ', note: '다른이름' }, { payer: '홍길동' }],
    );
    assert.deepEqual(names, ['홍길동']);
  });
});

describe('잔금 알림과 주인 없는 입금', () => {
  it('잔금·총액만 팀장에게 가고 계약금은 가지 않는다', () => {
    assert.equal(notifiesTeamLeader('BALANCE'), true);
    assert.equal(notifiesTeamLeader('TOTAL'), true);
    assert.equal(notifiesTeamLeader('DEPOSIT'), false);
    assert.equal(notifiesTeamLeader('OTHER'), false);
    assert.equal(balancePushBody('김고객', 230000), '김고객 고객 230,000원');
  });

  it('계약금으로 쓰인 금액은 주인 없는 잔금이 아니다', () => {
    const amounts = contractDepositAmounts([0, null, 20000, 30000]);
    assert.equal(isOpenBalanceDeposit(20000, amounts), false);
    assert.equal(isOpenBalanceDeposit(230000, amounts), true);
    assert.equal(openPushBody('홍길동', 230000), '홍길동 230,000원');
  });

  it('다시 알리기는 낮 시간·10분·48시간만 허용한다', () => {
    const morning = new Date('2026-11-24T00:30:00.000Z');
    const depositedAt = new Date('2026-11-23T10:00:00.000Z');
    assert.equal(canRemindOpenDeposit({ now: morning, depositedAt, lastRemindedAt: null }), true);
    assert.equal(
      canRemindOpenDeposit({
        now: morning,
        depositedAt,
        lastRemindedAt: new Date(morning.getTime() - 5 * 60 * 1000),
      }),
      false,
    );
    const night = new Date('2026-11-24T13:30:00.000Z');
    assert.equal(canRemindOpenDeposit({ now: night, depositedAt, lastRemindedAt: null }), false);
    const late = new Date(depositedAt.getTime() + 48 * 60 * 60 * 1000);
    assert.equal(canRemindOpenDeposit({ now: late, depositedAt, lastRemindedAt: null }), false);
  });

  it('재직 팀장 전원이 거절하면 주인이 없다', () => {
    assert.equal(allLeadersDeclined(2, 2), true);
    assert.equal(allLeadersDeclined(1, 2), false);
    assert.equal(allLeadersDeclined(0, 0), false);
  });

  it('휴대폰 알림은 시험용 함수로만 보낸다', async () => {
    const sent: string[] = [];
    setBankDepositTeamPushSender(async (items) => {
      sent.push(items[0]?.title ?? '');
    });
    await pushBankDepositToLeaders([
      { userId: 'leader-1', tenantId: 'tenant-a', title: '잔금이 입금됐어요', body: '고객 고객 1원', path: '/team/assignments' },
    ]);
    assert.deepEqual(sent, ['잔금이 입금됐어요']);
    setBankDepositTeamPushSender(null);
  });
});

describe('팀장 확인과 회사 입금 대기', () => {
  it('배정되지 않으면 막고, 금액이 다르면 사유가 필요하다', () => {
    assert.equal(
      claimDecision({ assigned: false, kind: 'BALANCE', amountWon: 1, balanceWon: 1, mismatchReason: null }),
      'forbidden',
    );
    assert.equal(
      claimDecision({ assigned: true, kind: 'BALANCE', amountWon: 2, balanceWon: 1, mismatchReason: null }),
      'mismatch',
    );
    assert.equal(
      claimDecision({ assigned: true, kind: 'DEPOSIT', amountWon: 1, balanceWon: 1, mismatchReason: null }),
      'bad_kind',
    );
    assert.equal(
      claimDecision({ assigned: true, kind: 'BALANCE', amountWon: 2, balanceWon: 1, mismatchReason: 'PARTIAL' }),
      'ok',
    );
  });

  it('대기 이름과 금액이 한 건일 때만 연결하고, 취소 후 후보는 없다', () => {
    const one = soleByNameAndAmount(
      [{ id: 'e1', depositorName: '홍 길동', amountWon: 230000 }],
      '홍길동',
      230000,
    );
    assert.equal(one?.id, 'e1');
    const two = soleByNameAndAmount(
      [
        { id: 'e1', depositorName: '홍길동', amountWon: 230000 },
        { id: 'e2', depositorName: '홍길동', amountWon: 230000 },
      ],
      '홍길동',
      230000,
    );
    assert.equal(two, null);
    assert.equal(soleByNameAndAmount([], '홍길동', 230000), null);
    assert.equal(customerBalanceWon({
      serviceBalanceAmount: 200000,
      serviceTotalAmount: 250000,
      serviceDepositAmount: 50000,
      companyDepositExtraWon: 30000,
    }), 230000);
  });

  it('다른 업체와 꺼진 기능은 막는다', () => {
    assert.equal(sameTenant('tenant-a', 'tenant-b'), false);
    assert.equal(bankDepositFeatureStatus(false), 403);
  });
});
