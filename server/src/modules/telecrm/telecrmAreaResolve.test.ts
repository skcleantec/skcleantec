import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyAiQuote } from './telecrmAiQuoteClassify.js';
import { resolveAiQuoteCore, skAiQuoteBaseRows } from './telecrmAiQuoteBase.js';
import {
  draftAreaTeaching,
  judgeBareAreaUnit,
  resolveTelecrmArea,
  type AreaCaseRow,
  type AreaLedgerGroup,
} from './telecrmAreaResolve.js';

const TYPE59: AreaLedgerGroup = { exclusiveSqm: 59, supplyPyeong: 25 };
const TYPE84: AreaLedgerGroup = { exclusiveSqm: 84, supplyPyeong: 34 };

describe('면적 해석', () => {
  it('아파트 전용 84㎡는 공급 34평', () => {
    const result = resolveTelecrmArea({ raw: '전용 84㎡', buildingType: '아파트' });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 34);
  });

  it('아파트 33평은 공급 33평', () => {
    const result = resolveTelecrmArea({ raw: '33평', buildingType: '아파트' });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 33);
    assert.equal(result.source, '기본 규칙');
  });

  it('아파트 25평이고 주소가 없으면 확인 필요', () => {
    const result = resolveTelecrmArea({ raw: '25평', buildingType: '아파트' });
    assert.equal(result.status, '확인 필요');
    assert.equal(result.pyeong, null);
    assert.equal(result.candidates.some((row) => row.pyeong === 25), true);
    assert.equal(result.candidates.some((row) => row.pyeong === 34), true);
  });

  it('단지에 59형만 있으면 공급 25평', () => {
    const result = resolveTelecrmArea({ raw: '25평', buildingType: '아파트', address: '래미안아파트', ledger: [TYPE59] });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 25);
    assert.equal(result.source, '건축물대장');
  });

  it('건축물대장 공급 33.9평은 34평으로 견적', () => {
    const result = resolveTelecrmArea({
      raw: '33평',
      buildingType: '아파트',
      address: '잠실엘스',
      ledger: [{ exclusiveSqm: 84.8, supplyPyeong: 33.9 }],
    });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 34);
    assert.equal(result.source, '건축물대장');
    assert.match(result.reason, /공급 34평 \(건축물대장 33\.9평\)/);
  });

  it('건축물대장 후보 25.7과 33.9는 26평과 34평', () => {
    const result = resolveTelecrmArea({
      raw: '25평',
      buildingType: '아파트',
      address: '잠실엘스',
      ledger: [
        { exclusiveSqm: 60, supplyPyeong: 25.7 },
        { exclusiveSqm: 84.8, supplyPyeong: 33.9 },
      ],
    });
    assert.equal(result.status, '확인 필요');
    assert.equal(result.pyeong, null);
    assert.equal(result.candidates[0]?.pyeong, 26);
    assert.equal(result.candidates[0]?.label, '공급 26평(59형)');
    assert.equal(result.candidates[1]?.pyeong, 34);
    assert.equal(result.candidates[1]?.label, '공급 34평(84형)');
  });

  it('단지에 84형만 있으면 공급 34평', () => {
    const result = resolveTelecrmArea({ raw: '25평', buildingType: '아파트', address: '래미안아파트', ledger: [TYPE84] });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 34);
    assert.equal(result.source, '건축물대장');
  });

  it('오피스텔 공급 30평은 전용 16평', () => {
    const result = resolveTelecrmArea({ raw: '공급 30평', buildingType: '오피스텔' });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 16);
  });

  it('빌라 공급 20평은 비율이 없으면 확인 필요', () => {
    const result = resolveTelecrmArea({ raw: '공급 20평', buildingType: '빌라(연립)' });
    assert.equal(result.status, '확인 필요');
    assert.equal(result.pyeong, null);
  });

  it('아파트 84는 확인 필요, 후보 34평과 84평', () => {
    const result = resolveTelecrmArea({ raw: '84', buildingType: '아파트' });
    assert.equal(result.status, '확인 필요');
    assert.equal(result.pyeong, null);
    assert.equal(result.candidates[0]?.pyeong, 34);
    assert.match(result.candidates[0]?.label ?? '', /84형/);
    assert.equal(result.candidates[1]?.pyeong, 84);
    assert.match(result.candidates[1]?.label ?? '', /84평/);
  });

  it('아파트 59는 확인 필요, 후보 25평과 59평', () => {
    const result = resolveTelecrmArea({ raw: '59', buildingType: '아파트' });
    assert.equal(result.status, '확인 필요');
    assert.equal(result.pyeong, null);
    assert.equal(result.candidates[0]?.pyeong, 25);
    assert.match(result.candidates[0]?.label ?? '', /59형/);
    assert.equal(result.candidates[1]?.pyeong, 59);
  });

  it('공급 22평은 전용 학습보다 고객 표시가 우선', () => {
    const taught = draftAreaTeaching('아파트 고객이 22평이라고 하면 전용이야');
    assert.ok(taught);
    const result = resolveTelecrmArea({ raw: '공급 22평', buildingType: '아파트', rules: taught.rules.map((row) => row.spec) });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 22);
    assert.equal(result.source, '기본 규칙');
  });

  it('아파트 22평을 전용으로 배우면 공급 29평', () => {
    const taught = draftAreaTeaching('아파트 고객이 22평이라고 하면 전용이야');
    assert.ok(taught);
    const result = resolveTelecrmArea({ raw: '22평', buildingType: '아파트', rules: taught.rules.map((row) => row.spec) });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 29);
    assert.equal(result.source, '사장님 기준');
    assert.match(taught.reply, /29평/);
  });

  it('같은 단지 사례 2건이면 확정', () => {
    const cases: AreaCaseRow[] = [
      { addressKey: '래미안아파트', customerValue: 25, customerMark: null, supplyPyeong: 25 },
      { addressKey: '래미안아파트', customerValue: 25, customerMark: null, supplyPyeong: 25 },
    ];
    const result = resolveTelecrmArea({
      raw: '25평',
      buildingType: '아파트',
      address: '래미안아파트 101동 1502호',
      cases,
      ledger: [TYPE59, TYPE84],
    });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 25);
    assert.equal(result.source, '사례');
    assert.match(result.reason, /사례 2건/);
  });
});

describe('방 구조로 평·㎡ 가리기', () => {
  it('오피스텔 1.5룸 31은 9평이고 기준표 15만', () => {
    const result = resolveTelecrmArea({
      raw: '31',
      buildingType: '오피스텔',
      roomText: '기타: 1.5룸',
      bathroomCount: 1,
    });
    assert.equal(result.status, '확정');
    assert.equal(result.pyeong, 9);
    assert.equal(result.reinterpreted, 'sqm');
    assert.equal(result.literalPyeong, 31);
    assert.equal(result.reason, '고객이 적은 값 31 · 오피스텔 1.5룸 → 31㎡로 봄 → 9평');
    assert.doesNotMatch(result.reason, /아파트 공급/);
    const classified = classifyAiQuote({
      propertyTypeLabel: '오피스텔',
      isOneRoom: true,
      roomCount: 1,
      bathroomCount: 1,
      areaPyeong: result.pyeong,
    });
    const quote = resolveAiQuoteCore({ classified, propertyLabel: '오피스텔', baseRows: skAiQuoteBaseRows() });
    assert.equal(quote?.amountWon, 150000);
    assert.match(quote?.label ?? '', /20평 이하/);
    assert.match(quote?.label ?? '', /기준표/);
  });

  it('원룸 15는 15평 그대로', () => {
    const result = resolveTelecrmArea({ raw: '15', isOneRoom: true, roomText: '원룸' });
    assert.equal(result.pyeong, 15);
    assert.equal(result.reinterpreted, null);
  });

  it('방3 84는 25평', () => {
    const result = resolveTelecrmArea({ raw: '84', buildingType: '아파트', roomCount: 3, bathroomCount: 2 });
    assert.equal(result.pyeong, 25);
    assert.equal(result.reinterpreted, 'sqm');
    assert.equal(result.literalPyeong, 84);
    assert.match(result.reason, /84㎡로 봄 → 25평/);
  });

  it('방3 33은 33평 그대로이고 아파트는 공급', () => {
    const result = resolveTelecrmArea({ raw: '33', buildingType: '아파트', roomCount: 3 });
    assert.equal(result.pyeong, 33);
    assert.equal(result.reinterpreted, null);
    assert.match(result.reason, /아파트 공급 33평 \(기본 규칙\)/);
  });

  it('방2 59는 18평', () => {
    const result = resolveTelecrmArea({ raw: '59', buildingType: '아파트', roomCount: 2, bathroomCount: 1 });
    assert.equal(result.pyeong, 18);
    assert.equal(result.reinterpreted, 'sqm');
    assert.equal(result.literalPyeong, 59);
  });

  it('31평이라고 적으면 오피스텔 1.5룸이어도 31평', () => {
    const result = resolveTelecrmArea({
      raw: '31평',
      buildingType: '오피스텔',
      roomText: '기타: 1.5룸',
      bathroomCount: 1,
    });
    assert.equal(result.pyeong, 31);
    assert.equal(result.reinterpreted, null);
    assert.match(result.reason, /오피스텔 전용 31평/);
    assert.doesNotMatch(result.reason, /아파트 공급/);
  });

  it('방 정보가 없으면 아파트 84는 지금처럼 확인 필요', () => {
    const result = resolveTelecrmArea({ raw: '84', buildingType: '아파트' });
    assert.equal(result.status, '확인 필요');
    assert.equal(result.pyeong, null);
    assert.equal(result.reinterpreted, null);
  });

  it('빌라 기본 문구는 전용', () => {
    const result = resolveTelecrmArea({ raw: '18평', buildingType: '빌라(연립)' });
    assert.equal(result.pyeong, 18);
    assert.match(result.reason, /빌라\(연립\) 전용 18평/);
    assert.doesNotMatch(result.reason, /아파트 공급/);
  });

  it('주거 유형만 오피스텔이면 아파트 공급이라고 하지 않는다', () => {
    const result = resolveTelecrmArea({ raw: '18평', propertyType: '오피스텔' });
    assert.match(result.reason, /오피스텔 전용 18평/);
    assert.doesNotMatch(result.reason, /아파트/);
  });

  it('사장님이 오피스텔 31평 규칙을 적어 두면 ㎡로 바꾸지 않는다', () => {
    const taught = draftAreaTeaching('오피스텔 고객이 31평이라고 하면 전용이야');
    assert.ok(taught);
    const result = resolveTelecrmArea({
      raw: '31',
      buildingType: '오피스텔',
      roomText: '기타: 1.5룸',
      bathroomCount: 1,
      rules: taught.rules.map((row) => row.spec),
    });
    assert.equal(result.reinterpreted, null);
    assert.notEqual(result.pyeong, 9);
    assert.equal(result.source, '사장님 기준');
  });

  it('방 수가 기타여도 원문에서 투룸을 읽는다', () => {
    const judged = judgeBareAreaUnit({ value: 59, unitExplicit: false, roomCount: null, roomText: '기타: 투룸' });
    assert.equal(judged.applied, true);
    if (judged.applied) assert.equal(judged.pyeong, 18);
  });
});
