import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  teamCashbillDefaultTaxKind,
  teamCashbillExemptLocked,
  teamCashbillOverTotalWarning,
  teamCashbillReasonRequired,
  teamCashbillTaxKind,
  teamCashbillUsage,
  teamCashbillVisible,
} from './teamCashbill.access.js';

describe('team cashbill access', () => {
  it('모듈이 꺼지면 팀장 화면에서 숨긴다', () => {
    assert.equal(
      teamCashbillVisible({ moduleOn: false, tenantAllows: true, leaderAllows: true, role: 'TEAM_LEADER' }),
      false,
    );
  });

  it('업체 설정이 꺼지면 숨긴다', () => {
    assert.equal(
      teamCashbillVisible({ moduleOn: true, tenantAllows: false, leaderAllows: true, role: 'TEAM_LEADER' }),
      false,
    );
  });

  it('팀장별 스위치가 꺼지면 숨긴다', () => {
    assert.equal(
      teamCashbillVisible({ moduleOn: true, tenantAllows: true, leaderAllows: false, role: 'TEAM_LEADER' }),
      false,
    );
  });

  it('팀장이 아니면 숨긴다', () => {
    assert.equal(
      teamCashbillVisible({ moduleOn: true, tenantAllows: true, leaderAllows: true, role: 'EXTERNAL_PARTNER' }),
      false,
    );
  });

  it('모듈·업체·팀장이 모두 켜지면 보인다', () => {
    assert.equal(
      teamCashbillVisible({ moduleOn: true, tenantAllows: true, leaderAllows: true, role: 'TEAM_LEADER' }),
      true,
    );
  });
});

describe('team cashbill reason and warning', () => {
  it('이미 발행한 접수는 사유가 필요하다', () => {
    assert.equal(
      teamCashbillReasonRequired({ alreadyIssued: true, amount: 10000, total: 100000, remaining: 50000 }),
      true,
    );
  });

  it('처음 발행이고 잔액 안이면 사유가 필요 없다', () => {
    assert.equal(
      teamCashbillReasonRequired({ alreadyIssued: false, amount: 40000, total: 100000, remaining: 50000 }),
      false,
    );
  });

  it('지출증빙만 사업자로 받고 그 외는 소득공제', () => {
    assert.equal(teamCashbillUsage('biz'), 'biz');
    assert.equal(teamCashbillUsage('phone'), 'phone');
    assert.equal(teamCashbillUsage('voluntary'), 'phone');
    assert.equal(teamCashbillUsage(undefined), 'phone');
  });

  it('면세가 아니면 과세로 받는다', () => {
    assert.equal(teamCashbillTaxKind('exempt'), 'exempt');
    assert.equal(teamCashbillTaxKind('taxable'), 'taxable');
    assert.equal(teamCashbillTaxKind('zero'), 'taxable');
    assert.equal(teamCashbillTaxKind(undefined), 'taxable');
  });

  it('연결된 계산서가 모두 면세면 기본값을 면세로 고정한다', () => {
    assert.equal(teamCashbillExemptLocked(['4', '4']), true);
    assert.equal(teamCashbillExemptLocked(['4', '1']), false);
    assert.equal(teamCashbillExemptLocked([]), false);
    assert.equal(teamCashbillDefaultTaxKind({ stored: 'taxable', exemptLocked: true }), 'exempt');
    assert.equal(teamCashbillDefaultTaxKind({ stored: 'exempt', exemptLocked: false }), 'exempt');
    assert.equal(teamCashbillDefaultTaxKind({ stored: '기타', exemptLocked: false }), 'taxable');
  });

  it('금액이 총액보다 크면 경고 문구를 준다', () => {
    assert.equal(
      teamCashbillOverTotalWarning(120000, 100000),
      '금액이 접수 총액보다 큽니다. 맞는지 확인해 주세요.',
    );
    assert.equal(teamCashbillOverTotalWarning(80000, 100000), null);
  });
});
