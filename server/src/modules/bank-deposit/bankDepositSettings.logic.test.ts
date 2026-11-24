import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankDepositFeatureDisabledBody } from './bankDepositGuard.js';
import { mergeIntoManualRow } from './bankDepositIngest.logic.js';
import {
  applySettingsPatch,
  DEFAULT_BANK_DEPOSIT_SETTINGS,
  isTeamAskDeposit,
  manualDepositProblems,
  openAlertDrift,
  tombstoneBlocks,
  type BankDepositSettingsShape,
} from './bankDepositSettings.logic.js';
import { canRemindOpenDeposit } from './bankDepositTeam.logic.js';

const now = new Date('2026-11-24T01:00:00.000Z');
const fresh = new Date('2026-11-24T00:30:00.000Z');

function ask(partial: Partial<Parameters<typeof isTeamAskDeposit>[0]> = {}) {
  return isTeamAskDeposit({
    status: 'NEEDS_REVIEW',
    amountWon: 230000,
    depositedAt: fresh,
    now,
    settings: DEFAULT_BANK_DEPOSIT_SETTINGS,
    contractAmounts: new Set([20000]),
    stopped: false,
    noOwner: false,
    ...partial,
  });
}

describe('입금 알림 설정', () => {
  it('줄이 없으면 기본값이다', () => {
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.teamAlertMinAmountWon, 50000);
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.teamReminderIntervalMin, 10);
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.teamAlertStartHour, 8);
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.teamAlertEndHour, 21);
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.teamReminderMaxHours, 48);
    assert.equal(DEFAULT_BANK_DEPOSIT_SETTINGS.depositAmountsMode, 'auto');
  });

  it('일부만 저장하고, 범위를 벗어나면 이유를 준다', () => {
    const saved = applySettingsPatch(DEFAULT_BANK_DEPOSIT_SETTINGS, { teamReminderIntervalMin: 30 });
    assert.equal(saved.ok, true);
    if (saved.ok) assert.equal(saved.settings.teamReminderIntervalMin, 30);
    const bad = applySettingsPatch(DEFAULT_BANK_DEPOSIT_SETTINGS, { teamReminderIntervalMin: 15 });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /10분/);
    const hours = applySettingsPatch(DEFAULT_BANK_DEPOSIT_SETTINGS, { teamAlertStartHour: 21, teamAlertEndHour: 8 });
    assert.equal(hours.ok, false);
    const manual = applySettingsPatch(DEFAULT_BANK_DEPOSIT_SETTINGS, { depositAmountsMode: 'manual', depositAmountsWon: [] });
    assert.equal(manual.ok, false);
  });

  it('끄기·최소 금액·계약금 직접 정하기·기간이 팀장 대상을 가른다', () => {
    assert.equal(ask(), true);
    assert.equal(ask({ amountWon: 10000 }), false);
    assert.equal(ask({ settings: { ...DEFAULT_BANK_DEPOSIT_SETTINGS, teamOpenAlertEnabled: false } }), false);
    assert.equal(ask({ amountWon: 20000 }), false);
    const manual: BankDepositSettingsShape = {
      ...DEFAULT_BANK_DEPOSIT_SETTINGS,
      depositAmountsMode: 'manual',
      depositAmountsWon: [230000],
    };
    assert.equal(ask({ settings: manual, contractAmounts: new Set([230000]) }), false);
    assert.equal(ask({ settings: manual, contractAmounts: new Set([20000]), amountWon: 80000 }), true);
    const old = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    assert.equal(ask({
      depositedAt: old,
      settings: { ...DEFAULT_BANK_DEPOSIT_SETTINGS, teamReminderMaxHours: 3 },
    }), false);
  });

  it('다시 알리기는 설정한 시간·간격·기간만 허용한다', () => {
    const morning = new Date('2026-11-24T00:30:00.000Z');
    assert.equal(canRemindOpenDeposit({
      now: morning,
      depositedAt: fresh,
      lastRemindedAt: null,
      startHour: 9,
      endHour: 18,
      intervalMin: 20,
      maxHours: 6,
    }), true);
    assert.equal(canRemindOpenDeposit({
      now: morning,
      depositedAt: fresh,
      lastRemindedAt: new Date(morning.getTime() - 15 * 60 * 1000),
      intervalMin: 20,
    }), false);
    assert.equal(canRemindOpenDeposit({
      now: new Date('2026-11-24T13:30:00.000Z'),
      depositedAt: fresh,
      lastRemindedAt: null,
    }), false);
    assert.equal(canRemindOpenDeposit({
      now,
      depositedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      lastRemindedAt: null,
      maxHours: 3,
    }), false);
  });

  it('대상에서 빠지면 팀장 화면에서 지우고, 다시 대상이면 다음 주기에 연다', () => {
    assert.equal(openAlertDrift({ wasAsked: true, nowAsked: false, wasNotified: true, stopped: false, noOwner: false }), 'resolve');
    assert.equal(openAlertDrift({ wasAsked: false, nowAsked: true, wasNotified: false, stopped: true, noOwner: false }), 'reopen');
    assert.equal(openAlertDrift({ wasAsked: true, nowAsked: false, wasNotified: true, stopped: false, noOwner: true }), 'keep');
  });
});

describe('직접 추가와 삭제', () => {
  it('금액·이름·시각을 검사한다', () => {
    assert.equal(manualDepositProblems({ amountWon: 230000, depositorName: '김예시', depositedAt: fresh, now }), null);
    assert.match(manualDepositProblems({ amountWon: 0, depositorName: '김예시', depositedAt: fresh, now }) ?? '', /금액/);
    assert.match(manualDepositProblems({
      amountWon: 1000,
      depositorName: '김예시',
      depositedAt: new Date(now.getTime() + 10 * 60 * 1000),
      now,
    }) ?? '', /뒤/);
    assert.match(manualDepositProblems({
      amountWon: 1000,
      depositorName: '김예시',
      depositedAt: new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000),
      now,
    }) ?? '', /60일/);
  });

  it('나중에 온 같은 문자는 직접 넣은 줄에 해시를 채운다', () => {
    const merged = mergeIntoManualRow(
      [{ id: 'manual-1', contentHash: null, depositorName: '김 예시' }],
      { contentHash: 'a'.repeat(64), depositorName: '김예시' },
    );
    assert.equal(merged?.fillId, 'manual-1');
    assert.equal(mergeIntoManualRow(
      [{ id: 'manual-1', contentHash: 'b'.repeat(64), depositorName: '김예시' }],
      { contentHash: 'a'.repeat(64), depositorName: '김예시' },
    ), null);
  });

  it('기능이 꺼지면 403이다', () => {
    assert.equal(bankDepositFeatureDisabledBody().code, 'feature_disabled');
  });

  it('지운 문자의 재수신은 막고, 직접 추가는 막지 않는다', () => {
    assert.equal(tombstoneBlocks('sms', true), true);
    assert.equal(tombstoneBlocks('scan', true), true);
    assert.equal(tombstoneBlocks('manual', true), false);
    assert.equal(tombstoneBlocks('sms', false), false);
  });
});
