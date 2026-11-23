import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMPTY_WORK_ACTIONS,
  applyWorkFinish,
  canEditWorkEntry,
  canReadWorkEntry,
  countsAsPendingUnsaved,
  isStaleOpen,
  mergeWorkActions,
  resolveListUserId,
  retentionCutoffs,
  staleOpenOutcome,
  workEntryDidSomething,
} from './telecrmWorkHistory.logic.js';

const minute = 60 * 1000;
const day = 24 * 60 * minute;

describe('작업 기록 권한', () => {
  it('본인 줄만 고칠 수 있다', () => {
    assert.equal(canEditWorkEntry('me', 'me'), true);
    assert.equal(canEditWorkEntry('me', 'other'), false);
  });

  it('마케터는 남의 기록을 볼 수 없고 관리자는 전체를 본다', () => {
    assert.equal(canReadWorkEntry(false, 'me', 'other'), false);
    assert.equal(canReadWorkEntry(true, 'admin', 'other'), true);
    assert.equal(resolveListUserId(false, 'me', 'other'), 'me');
    assert.equal(resolveListUserId(true, 'admin', null), null);
    assert.equal(resolveListUserId(true, 'admin', 'marketer-1'), 'marketer-1');
  });
});

describe('열린 기록 방치', () => {
  const now = new Date('2026-11-23T06:00:00.000Z');

  it('30분이 지나면 손댄 줄은 UNSAVED, 보기만 한 줄은 VIEWED', () => {
    const fresh = new Date(now.getTime() - 10 * minute);
    const stale = new Date(now.getTime() - 31 * minute);
    assert.equal(isStaleOpen(fresh, now), false);
    assert.equal(isStaleOpen(stale, now), true);
    assert.equal(staleOpenOutcome({ ...EMPTY_WORK_ACTIONS, fieldsEdited: true }), 'UNSAVED');
    assert.equal(staleOpenOutcome(EMPTY_WORK_ACTIONS), 'VIEWED');
    assert.equal(workEntryDidSomething({ ...EMPTY_WORK_ACTIONS, smsCount: 1 }), true);
  });
});

describe('끝내기·빨간 숫자·정리', () => {
  const now = new Date('2026-11-23T06:00:00.000Z');

  it('저장으로 끝내면 적던 내용을 지운다', () => {
    const saved = applyWorkFinish(
      { outcome: 'SAVED', savedKind: 'absent', draft: { requestMemo: '남김' }, summary: '메모' },
      now,
    );
    assert.equal(saved.draft, null);
    assert.equal(saved.savedKind, 'absent');
    const unsaved = applyWorkFinish({ outcome: 'UNSAVED', draft: { requestMemo: '남김' }, leftBy: 'switch' }, now);
    assert.deepEqual(unsaved.draft, { requestMemo: '남김' });
  });

  it('필요 없음·이어서 하기 뒤에는 빨간 숫자에서 빠진다', () => {
    const row = {
      outcome: 'UNSAVED',
      dismissedAt: null as Date | null,
      resumedAt: null as Date | null,
      startedAt: new Date(now.getTime() - 2 * day),
    };
    assert.equal(countsAsPendingUnsaved(row, now), true);
    assert.equal(countsAsPendingUnsaved({ ...row, dismissedAt: now }, now), false);
    assert.equal(countsAsPendingUnsaved({ ...row, resumedAt: now }, now), false);
    assert.equal(countsAsPendingUnsaved({ ...row, startedAt: new Date(now.getTime() - 15 * day) }, now), false);
  });

  it('30일이 지난 줄은 지우고 14일이 지난 적던 내용은 비운다', () => {
    const cut = retentionCutoffs(now);
    assert.equal(now.getTime() - cut.deleteBefore.getTime(), 30 * day);
    assert.equal(now.getTime() - cut.clearDraftBefore.getTime(), 14 * day);
  });

  it('행동 숫자는 보낸 키만 바꾼다', () => {
    const next = mergeWorkActions(EMPTY_WORK_ACTIONS, { callCount: 2, fieldsEdited: true });
    assert.equal(next.callCount, 2);
    assert.equal(next.fieldsEdited, true);
    assert.equal(next.smsCount, 0);
  });
});
