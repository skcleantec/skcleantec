import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankDepositFeatureDisabledBody } from './bankDepositGuard.js';
import {
  depositListCounts,
  inquiryDepositSync,
  kindBlocksDeposit,
  leadersOnDuty,
  restoredDepositStatus,
} from './bankDepositCancel.logic.js';
import { DEFAULT_BANK_DEPOSIT_SETTINGS, isTeamAskDeposit } from './bankDepositSettings.logic.js';

const now = new Date('2026-11-24T01:00:00.000Z');

describe('입금 예약취소', () => {
  it('접수 취소와 되돌림만 입금을 따라가게 한다', () => {
    assert.equal(inquiryDepositSync('RECEIVED', 'CANCELLED'), 'cancel');
    assert.equal(inquiryDepositSync('CANCELLED', 'RECEIVED'), 'restore');
    assert.equal(inquiryDepositSync('CANCELLED', 'CANCELLED'), 'none');
    assert.equal(inquiryDepositSync('RECEIVED', 'ASSIGNED'), 'none');
  });

  it('이전 상태로 되돌리고, 없으면 연결 여부로 정한다', () => {
    assert.equal(restoredDepositStatus({ cancelPrevStatus: 'AUTO_LINKED', linked: true }), 'AUTO_LINKED');
    assert.equal(restoredDepositStatus({ cancelPrevStatus: 'LINKED', linked: true }), 'LINKED');
    assert.equal(restoredDepositStatus({ cancelPrevStatus: null, linked: true }), 'LINKED');
    assert.equal(restoredDepositStatus({ cancelPrevStatus: null, linked: false }), 'NEEDS_REVIEW');
    assert.equal(restoredDepositStatus({ cancelPrevStatus: 'NEEDS_REVIEW', linked: false }), 'NEEDS_REVIEW');
  });

  it('예약취소는 팀장 대상과 막힘 계산에서 빠진다', () => {
    assert.equal(
      isTeamAskDeposit({
        status: 'CANCELLED',
        amountWon: 230000,
        depositedAt: now,
        now,
        settings: DEFAULT_BANK_DEPOSIT_SETTINGS,
        contractAmounts: new Set(),
        stopped: false,
        noOwner: false,
      }),
      false,
    );
    assert.equal(kindBlocksDeposit('CANCELLED'), false);
    assert.equal(kindBlocksDeposit('LINKED'), true);
    assert.equal(kindBlocksDeposit('AUTO_LINKED'), true);
  });

  it('오늘 합계에 예약취소를 포함하고 건수도 따로 센다', () => {
    const counts = depositListCounts([
      { status: 'LINKED', n: 2 },
      { status: 'NEEDS_REVIEW', n: 1 },
      { status: 'IGNORED', n: 1 },
      { status: 'CANCELLED', n: 3 },
    ]);
    assert.equal(counts.today, 7);
    assert.equal(counts.cancelled, 3);
    assert.equal(counts.needsReview, 1);
    assert.equal(counts.ignored, 1);
  });
});

describe('휴무 팀장', () => {
  const leaders = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('켜면 휴무인 팀장을 알림 대상에서 뺀다', () => {
    const onDuty = leadersOnDuty(leaders, new Set(['b']), true);
    assert.deepEqual(onDuty.map((row) => row.id), ['a', 'c']);
  });

  it('끄면 휴무여도 포함한다', () => {
    assert.equal(leadersOnDuty(leaders, new Set(['b']), false).length, 3);
  });

  it('기본값은 휴무 팀장을 뺀다', () => {
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.skipDayOffLeaders, true);
  });
});

describe('입금 기능 꺼짐', () => {
  it('403 본문의 코드는 feature_disabled 이다', () => {
    assert.equal(bankDepositFeatureDisabledBody().code, 'feature_disabled');
  });
});
