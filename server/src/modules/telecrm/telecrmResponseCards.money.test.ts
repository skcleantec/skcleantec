import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectAllowedManWons,
  resolveCoachMoneyLine,
  resolveCoachMoneyLines,
  scrubCoachSpeech,
} from './telecrmResponseCards.money.js';

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

  it('32평 외창 답에는 30평이 남지 않는다', () => {
    const lines = resolveCoachMoneyLines({ q: '외창 얼마예요', pyeong: '32', rules: [EXTERIOR_RULE] });
    const joined = lines.join('\n');
    assert.match(joined, /30만 원/);
    assert.equal(/30\s*평/.test(joined), false);
    const spoken = scrubCoachSpeech('외창은 30평 기준으로 30만 원이에요.', {
      pyeong: 32,
      allowedMan: collectAllowedManWons(lines),
    });
    assert.equal(/30\s*평/.test(spoken.text), false);
    assert.match(spoken.text, /32평/);
    assert.match(spoken.text, /30만 원/);
  });

  it('견적 합계 35만이면 합계와 실제 부담만 말한다', () => {
    const lines = resolveCoachMoneyLines({ q: '얼마예요', pyeong: '32', rules: [], quoteTotalManWon: 35 });
    const joined = lines.join('\n');
    assert.match(joined, /35만 원/);
    assert.match(joined, /33만 원/);
    const amounts = [...joined.matchAll(/(\d+(?:\.\d+)?)\s*만/g)].map((match) => Number(match[1]));
    assert.deepEqual([...amounts].sort((a, b) => a - b), [33, 35]);
  });

  it('32평 외창은 결과만 남고 계산식 말은 없다', () => {
    const lines = resolveCoachMoneyLines({ q: '외창 얼마예요', pyeong: '32', rules: [EXTERIOR_RULE] });
    const joined = lines.join('\n');
    assert.match(joined, /30만 원/);
    assert.equal(joined.includes('평당'), false);
    assert.equal(/20\s*평/.test(joined), false);
    assert.equal(/32\s*평\s*이상/.test(joined), false);
    const spoken = scrubCoachSpeech(
      '외창은 평당 1만 원이고, 32평이면 30만 원이에요. 20평 이상은 2만 원 할인도 가능해요.',
      { pyeong: 32, allowedMan: collectAllowedManWons(lines) },
    );
    assert.match(spoken.text, /30만 원/);
    assert.equal(spoken.text.includes('평당'), false);
    assert.equal(/20\s*평/.test(spoken.text), false);
    assert.equal(/32\s*평\s*이상/.test(spoken.text), false);
    assert.match(spoken.text, /32평이면 30만 원이에요/);
  });

  it('견적 42만에 외창을 더하면 포함 합계 72만 원', () => {
    const lines = resolveCoachMoneyLines({
      q: '외창까지 하면 총 얼마예요',
      pyeong: '32',
      rules: [EXTERIOR_RULE],
      quoteTotalManWon: 42,
    });
    const joined = lines.join('\n');
    assert.match(joined, /외창 포함 합계: 72만 원/);
    assert.match(joined, /외창 포함 실제 부담: 70만 원/);
  });

  it('15평 외창은 18만 원 결과만 말한다', () => {
    const line = resolveCoachMoneyLine({ q: '외창', pyeong: '15', rules: [EXTERIOR_RULE] });
    assert.match(line, /계산된 금액: 18만 원/);
    assert.equal(line.includes('평당'), false);
    assert.equal(/20\s*평/.test(line), false);
  });

  it('허용되지 않은 25만 원은 비운다', () => {
    const spoken = scrubCoachSpeech('총 25만원입니다.', {
      pyeong: null,
      allowedMan: collectAllowedManWons(['계산된 금액: 기본 견적 합계: 35만 원', '계산된 금액: 33만 원']),
    });
    assert.match(spoken.text, /○○만 원/);
    assert.equal(/\d+\s*만/.test(spoken.text), false);
    assert.equal(spoken.changes >= 1, true);
  });
});
