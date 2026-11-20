import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCoachMoneyLine } from './telecrmResponseCards.money.js';

const EXTERIOR_RULE = '외창 최저 18만. 20평 이상 = 평수×1만 − 2만';

describe('대응 카드 코치 금액', () => {
  it('외창 32평은 30만 원', () => {
    const line = resolveCoachMoneyLine({ q: '외창', pyeong: '32', rules: [EXTERIOR_RULE] });
    assert.match(line, /계산된 금액: 30만 원/);
    assert.equal(line.includes('28만'), false);
  });

  it('외창 15평은 최저 18만 원', () => {
    const line = resolveCoachMoneyLine({ q: '외창', pyeong: '15평', rules: [EXTERIOR_RULE] });
    assert.match(line, /계산된 금액: 18만 원/);
  });

  it('비싸고 평수가 없으면 금액 숫자를 넣지 않는다', () => {
    const line = resolveCoachMoneyLine({
      q: '비싸',
      pyeong: null,
      rules: ['방이 없는 원룸이면 15만 원'],
    });
    assert.match(line, /○○만 원/);
    assert.equal(/\d+\s*만/.test(line), false);
  });
});
