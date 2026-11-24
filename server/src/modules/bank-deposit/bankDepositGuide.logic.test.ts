import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankDepositFeatureDisabledBody, sameTenant } from './bankDepositGuard.js';
import { decideGuideAccountWrite, guideAccountForLeader } from './bankDepositGuide.logic.js';

const sample = { bankName: '국민', accountNumber: '123-456-789012', accountHolder: '청소비서' };

describe('입금 안내 계좌', () => {
  it('세 칸을 저장한다', () => {
    const saved = decideGuideAccountWrite({ isAdmin: true, brandInTenant: true, ...sample });
    assert.equal(saved.ok, true);
    if (saved.ok && saved.action === 'save') assert.deepEqual(saved.fields, sample);
  });

  it('모두 비면 지운다', () => {
    const cleared = decideGuideAccountWrite({
      isAdmin: true,
      brandInTenant: true,
      bankName: '  ',
      accountNumber: '',
      accountHolder: '',
    });
    assert.deepEqual(cleared, { ok: true, action: 'delete' });
  });

  it('일부만 비거나 형식이 벗어나면 이유를 준다', () => {
    const partial = decideGuideAccountWrite({
      isAdmin: true,
      brandInTenant: true,
      bankName: '국민',
      accountNumber: '',
      accountHolder: '청소비서',
    });
    assert.equal(partial.ok, false);
    if (!partial.ok) assert.match(partial.error, /모두/);
    const shortNo = decideGuideAccountWrite({
      isAdmin: true,
      brandInTenant: true,
      bankName: '국민',
      accountNumber: '12-3',
      accountHolder: '청소비서',
    });
    assert.equal(shortNo.ok, false);
    if (!shortNo.ok) assert.match(shortNo.error, /계좌번호/);
    const letters = decideGuideAccountWrite({
      isAdmin: true,
      brandInTenant: true,
      bankName: '국민',
      accountNumber: '1234 567890',
      accountHolder: '청소비서',
    });
    assert.equal(letters.ok, false);
    const longBank = decideGuideAccountWrite({
      isAdmin: true,
      brandInTenant: true,
      bankName: '가'.repeat(21),
      accountNumber: '123456',
      accountHolder: '청소비서',
    });
    assert.equal(longBank.ok, false);
    if (!longBank.ok) assert.match(longBank.error, /은행/);
    const longHolder = decideGuideAccountWrite({
      isAdmin: true,
      brandInTenant: true,
      bankName: '국민',
      accountNumber: '123456',
      accountHolder: '가'.repeat(41),
    });
    assert.equal(longHolder.ok, false);
    if (!longHolder.ok) assert.match(longHolder.error, /예금주/);
  });

  it('다른 업체 브랜드는 404, 관리자가 아니면 403', () => {
    const other = decideGuideAccountWrite({ isAdmin: true, brandInTenant: false, ...sample });
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.status, 404);
    const staff = decideGuideAccountWrite({ isAdmin: false, brandInTenant: true, ...sample });
    assert.equal(staff.ok, false);
    if (!staff.ok) assert.equal(staff.status, 403);
    assert.equal(sameTenant('tenant-a', 'tenant-b'), false);
  });

  it('기능이 꺼지면 403', () => {
    assert.equal(bankDepositFeatureDisabledBody().code, 'feature_disabled');
  });
});

describe('팀장 계좌입금', () => {
  it('배정된 팀장에게만 계좌를 주고, 없으면 null', () => {
    assert.deepEqual(guideAccountForLeader(true, sample), sample);
    assert.equal(guideAccountForLeader(true, null), null);
    assert.equal(guideAccountForLeader(false, sample), 'hidden');
  });
});
