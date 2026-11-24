import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consumeDeviceRate, deviceCanIngest, ingestSlot, resetDeviceRateForTests, sameTenant } from './bankDepositGuard.js';
import { matchBankDeposit, type InquiryAmountRow } from './bankDepositMatch.js';

function inquiry(partial: Partial<InquiryAmountRow> & Pick<InquiryAmountRow, 'id' | 'customerName'>): InquiryAmountRow {
  return {
    nickname: null,
    depositWon: null,
    balanceWon: null,
    totalWon: null,
    orderDepositWon: null,
    orderBalanceWon: null,
    orderTotalWon: null,
    blockedKinds: [],
    ...partial,
  };
}

describe('입금 맞추기', () => {
  it('이름과 금액이 맞는 접수가 하나면 자동 연결한다', () => {
    const result = matchBankDeposit({
      depositorName: '김 예시',
      amountWon: 20000,
      inquiries: [inquiry({ id: 'inq-1', customerName: '김예시', depositWon: 20000, balanceWon: 80000 })],
      followups: [],
    });
    assert.deepEqual(result.auto, { target: 'inquiry', id: 'inq-1', kind: 'DEPOSIT' });
  });

  it('같은 조건이 둘이면 자동 연결하지 않고 후보로 남긴다', () => {
    const result = matchBankDeposit({
      depositorName: '김예시',
      amountWon: 20000,
      inquiries: [
        inquiry({ id: 'inq-1', customerName: '김예시', depositWon: 20000 }),
        inquiry({ id: 'inq-2', customerName: '김예시(엄마)', depositWon: 20000 }),
      ],
      followups: [],
    });
    assert.equal(result.auto, null);
    assert.equal(result.candidates.length, 2);
  });

  it('이름만 같거나 금액만 같은 건은 이유와 함께 보여 준다', () => {
    const result = matchBankDeposit({
      depositorName: '김예시',
      amountWon: 80000,
      inquiries: [
        inquiry({ id: 'name-only', customerName: '김예시', depositWon: 20000 }),
        inquiry({ id: 'money-only', customerName: '박다른', balanceWon: 80000 }),
      ],
      followups: [{ id: 'fu-1', customerName: '김예시', nickname: null, status: 'DEPOSIT_PENDING' }],
    });
    assert.equal(result.auto, null);
    const nameOnly = result.candidates.find((row) => row.id === 'name-only');
    const moneyOnly = result.candidates.find((row) => row.id === 'money-only');
    const followup = result.candidates.find((row) => row.id === 'fu-1');
    assert.equal(nameOnly?.reasons[0], '이름만 같습니다');
    assert.equal(moneyOnly?.reasons[0], '잔금 금액만 같습니다');
    assert.match(followup?.reasons[0] ?? '', /예약금 대기/);
  });

  it('같은 종류가 이미 연결돼 있으면 자동 연결하지 않는다', () => {
    const result = matchBankDeposit({
      depositorName: '김예시',
      amountWon: 20000,
      inquiries: [inquiry({ id: 'inq-1', customerName: '김예시', orderDepositWon: 20000, blockedKinds: ['DEPOSIT'] })],
      followups: [],
    });
    assert.equal(result.auto, null);
    assert.match(result.candidates[0]?.reasons.join(' ') ?? '', /이미 계약금/);
  });

  it('발주서 잔금과 같으면 잔금으로 잡는다', () => {
    const result = matchBankDeposit({
      depositorName: '김예시',
      amountWon: 80000,
      inquiries: [inquiry({ id: 'inq-1', customerName: '김예시', orderBalanceWon: 80000 })],
      followups: [],
    });
    assert.equal(result.auto?.kind, 'BALANCE');
  });
});

describe('수신 경계', () => {
  it('같은 키는 다시 처리하지 않고, 해석 실패는 건너뛴다', () => {
    assert.equal(ingestSlot(true, true), 'duplicate');
    assert.equal(ingestSlot(false, false), 'skipped');
    assert.equal(ingestSlot(true, false), 'stored');
  });

  it('다른 업체 기록은 열 수 없고, 끊긴 기기는 받을 수 없다', () => {
    assert.equal(sameTenant('tenant-a', 'tenant-b'), false);
    assert.equal(sameTenant('tenant-a', 'tenant-a'), true);
    assert.equal(deviceCanIngest({ isActive: false, revokedAt: null }), false);
    assert.equal(deviceCanIngest({ isActive: true, revokedAt: new Date() }), false);
    assert.equal(deviceCanIngest({ isActive: true, revokedAt: null }), true);
  });

  it('한 기기는 1분에 60건을 넘기면 거절한다', () => {
    resetDeviceRateForTests();
    const now = 1_700_000_000_000;
    assert.equal(consumeDeviceRate('device-1', 50, now), true);
    assert.equal(consumeDeviceRate('device-1', 11, now + 1000), false);
    assert.equal(consumeDeviceRate('device-1', 10, now + 1000), true);
    assert.equal(consumeDeviceRate('device-1', 1, now + 61_000), true);
  });
});
