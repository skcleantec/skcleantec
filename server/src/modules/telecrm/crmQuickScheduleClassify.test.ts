import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyPreferredAnswer } from './crmQuickScheduleClassify.js';

const fetchedAt = new Date('2026-11-16T03:00:00.000Z');

describe('classifyPreferredAnswer', () => {
  it('가장 빠른 일정 문구는 ASAP', () => {
    for (const raw of ['가장 빠른', '가장 빠른 일정을 원함', '최대한 빨리', '빠를수록', '급해요', 'ASAP', '빨리']) {
      const got = classifyPreferredAnswer(raw, fetchedAt);
      assert.equal(got.kind, 'ASAP', raw);
      assert.equal(got.ymd, null, raw);
    }
  });

  it('일주일·이번 주는 가져온 날 + 7일', () => {
    for (const raw of ['일주일 이내', '1주일 안', '이번 주']) {
      const got = classifyPreferredAnswer(raw, fetchedAt);
      assert.equal(got.kind, 'WITHIN_WEEK', raw);
      assert.equal(got.ymd, '2026-11-23', raw);
    }
  });

  it('특정 날짜는 DATE', () => {
    assert.deepEqual(classifyPreferredAnswer('2026-11-20', fetchedAt), { kind: 'DATE', ymd: '2026-11-20' });
    assert.deepEqual(classifyPreferredAnswer('2026년 11월 17일', fetchedAt), { kind: 'DATE', ymd: '2026-11-17' });
    assert.deepEqual(classifyPreferredAnswer('11월 18일', fetchedAt), { kind: 'DATE', ymd: '2026-11-18' });
  });

  it('협의·상관없음은 목록에서 빼는 FLEXIBLE', () => {
    for (const raw of ['협의 가능', '상관없음', '아무때나']) {
      const got = classifyPreferredAnswer(raw, fetchedAt);
      assert.equal(got.kind, 'FLEXIBLE', raw);
      assert.equal(got.ymd, null, raw);
    }
  });

  it('바로는 급한 일정과 날짜를 가린다', () => {
    assert.deepEqual(classifyPreferredAnswer('바로 가능하면 좋겠어요', fetchedAt), { kind: 'ASAP', ymd: null });
    assert.deepEqual(classifyPreferredAnswer('당장 해주세요', fetchedAt), { kind: 'ASAP', ymd: null });
    assert.deepEqual(classifyPreferredAnswer('11월 20일 바로 이사 후', fetchedAt), { kind: 'DATE', ymd: '2026-11-20' });
    assert.deepEqual(classifyPreferredAnswer('11월 20일 빨리', fetchedAt), { kind: 'DATE', ymd: '2026-11-20' });
    assert.deepEqual(classifyPreferredAnswer('입주 바로 전날', fetchedAt), { kind: 'UNKNOWN', ymd: null });
    assert.deepEqual(classifyPreferredAnswer('바로', fetchedAt), { kind: 'UNKNOWN', ymd: null });
  });

  it('해석할 수 없으면 UNKNOWN', () => {
    assert.deepEqual(classifyPreferredAnswer('', fetchedAt), { kind: 'UNKNOWN', ymd: null });
    assert.deepEqual(classifyPreferredAnswer('잘 모르겠어요', fetchedAt), { kind: 'UNKNOWN', ymd: null });
    assert.deepEqual(classifyPreferredAnswer('2026-13-40', fetchedAt), { kind: 'UNKNOWN', ymd: null });
  });
});
