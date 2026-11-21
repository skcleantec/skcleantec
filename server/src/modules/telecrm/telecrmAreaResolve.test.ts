import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { draftAreaTeaching, resolveTelecrmArea, type AreaCaseRow, type AreaLedgerGroup } from './telecrmAreaResolve.js';

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
