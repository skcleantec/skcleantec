import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addressAttemptAnchors,
  addressSearchAttempts,
  isKeywordAddressError,
  parseRelJibun,
  sanitizeAddressKeyword,
  sortAddressRows,
} from './quickQuoteAddressQuery.js';

test('용현동 아이파크는 붙여 쓰고 동 이름을 뺀다', () => {
  const list = addressSearchAttempts('용현동 아이파크');
  assert.equal(list[0], '용현동 아이파크');
  assert.ok(list.includes('용현동아이파크'));
  assert.ok(list.includes('아이파크'));
});

test('아파트·단지 꼬리말을 뺀다', () => {
  assert.ok(addressSearchAttempts('래미안 아파트').includes('래미안'));
  assert.ok(addressSearchAttempts('송도센트럴파크단지').includes('송도센트럴파크'));
});

test('동네를 다 뺀 검색어는 그 동네 이름을 붙잡아 둔다', () => {
  assert.deepEqual(addressAttemptAnchors('용현동 아이파크', '아이파크'), ['용현동']);
  assert.deepEqual(addressAttemptAnchors('용현동 아이파크', '용현동아이파크'), []);
  assert.deepEqual(addressAttemptAnchors('인천 부평 래미안', '부평 래미안'), []);
  assert.deepEqual(addressAttemptAnchors('인천 부평 래미안', '래미안'), ['인천', '부평']);
});

test('맨 앞 지역어를 하나씩 뺀다', () => {
  const list = addressSearchAttempts('인천 부평 래미안');
  assert.ok(list.includes('부평 래미안'));
  assert.ok(list.includes('래미안'));
});

test('e편한세상·SK VIEW 대소문자와 띄어쓰기를 바꾼다', () => {
  const easy = addressSearchAttempts('e편한세상 시티 부평');
  assert.ok(easy.some((item) => item.startsWith('E편한세상') || item.startsWith('e 편한세상')));
  const view = addressSearchAttempts('SK VIEW');
  assert.ok(view.includes('SKVIEW'));
  assert.ok(view.includes('sk view'));
});

test('특수문자는 걸러 다시 묻는다', () => {
  assert.equal(sanitizeAddressKeyword('래미안#'), '래미안');
  assert.equal(addressSearchAttempts('래미안#')[0], '래미안');
  assert.equal(isKeywordAddressError('E0012'), true);
  assert.equal(isKeywordAddressError('E0013'), true);
  assert.equal(isKeywordAddressError('E0001'), false);
});

test('관련지번에서 산 번지를 가른다', () => {
  const lots = parseRelJibun('주안동 1575-1, 산 12-3, 124');
  assert.deepEqual(lots[0], { bun: '1575', ji: '1', mtYn: '0' });
  assert.deepEqual(lots[1], { bun: '12', ji: '3', mtYn: '1' });
  assert.deepEqual(lots[2], { bun: '124', ji: '0', mtYn: '0' });
});

test('공동주택이면서 건물명이 있는 줄을 위로 올린다', () => {
  const sorted = sortAddressRows([
    { bdKdcd: '0', bdNm: '' },
    { bdKdcd: '1', bdNm: '래미안' },
    { bdKdcd: '0', bdNm: '상가' },
  ]);
  assert.equal(sorted[0]?.bdNm, '래미안');
  assert.equal(sorted[1]?.bdNm, '상가');
  assert.equal(sorted[2]?.bdNm, '');
});
