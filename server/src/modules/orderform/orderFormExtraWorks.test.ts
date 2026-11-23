import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeOrderFormExtraWorks,
  orderFormExtraWorksTotalMatches,
  resolveOrderFormIssueMoney,
  sumOrderFormExtraWorks,
} from '../../lib/orderFormExtraWorks.js';

describe('추가 시공 정리', () => {
  it('이름 앞뒤 공백을 지우고 빈 줄은 뺀다', () => {
    const out = normalizeOrderFormExtraWorks([
      { name: '  인테리어 청소  ', amountWon: 50000 },
      { name: '   ', amountWon: 10000 },
      { name: '특수청소', amountWon: '30000' },
    ]);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.deepEqual(out.lines, [
      { name: '인테리어 청소', amountWon: 50000 },
      { name: '특수청소', amountWon: 30000 },
    ]);
    assert.equal(sumOrderFormExtraWorks(out.lines), 80000);
    assert.equal(orderFormExtraWorksTotalMatches(150000, out.lines, 230000), true);
  });

  it('이름이 너무 길거나 줄이 6개거나 금액이 정수가 아니면 거절한다', () => {
    assert.equal(normalizeOrderFormExtraWorks([{ name: '가'.repeat(31), amountWon: 0 }]).ok, false);
    assert.equal(
      normalizeOrderFormExtraWorks(
        Array.from({ length: 6 }, (_, i) => ({ name: `작업${i}`, amountWon: 1000 })),
      ).ok,
      false,
    );
    assert.equal(normalizeOrderFormExtraWorks([{ name: '특수청소', amountWon: 1.5 }]).ok, false);
    assert.equal(normalizeOrderFormExtraWorks([{ name: '특수청소', amountWon: -1 }]).ok, false);
  });
});

describe('발급 금액 재계산', () => {
  it('추가 시공이 있으면 기본 금액과 합계로 총액·잔금을 다시 계산한다', () => {
    const out = resolveOrderFormIssueMoney({
      extraWorks: [{ name: '인테리어 청소', amountWon: 30000 }],
      baseAmount: 200000,
      depositAmount: 20000,
      cleaningKind: 'MOVE_IN',
    });
    assert.deepEqual(out, {
      ok: true,
      hasExtraWorks: true,
      lines: [{ name: '인테리어 청소', amountWon: 30000 }],
      baseAmount: 200000,
      totalAmount: 230000,
      balanceAmount: 210000,
    });
  });

  it('추가 시공이 없으면 기존 총액 계산을 그대로 둔다', () => {
    const out = resolveOrderFormIssueMoney({
      extraWorks: [{ name: '  ', amountWon: 10000 }],
      baseAmount: 999,
      depositAmount: 20000,
      cleaningKind: null,
    });
    assert.deepEqual(out, { ok: true, hasExtraWorks: false });
  });

  it('추가 시공이 있는데 청소 종류나 기본 금액이 없으면 거절한다', () => {
    const noKind = resolveOrderFormIssueMoney({
      extraWorks: [{ name: '특수청소', amountWon: 10000 }],
      baseAmount: 150000,
      depositAmount: 20000,
      cleaningKind: null,
    });
    assert.equal(noKind.ok, false);
    if (!noKind.ok) assert.match(noKind.error, /청소 종류/);

    const noBase = resolveOrderFormIssueMoney({
      extraWorks: [{ name: '특수청소', amountWon: 10000 }],
      baseAmount: null,
      depositAmount: 20000,
      cleaningKind: 'SPECIAL',
    });
    assert.equal(noBase.ok, false);
    if (!noBase.ok) assert.match(noBase.error, /기본 청소 금액/);
  });
});
