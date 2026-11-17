import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  brandChannelStatusAfterDeposit,
  planBrandChannelRequest,
  setupFeeChargeLabel,
  splitVatInclusiveKrw,
} from './alimtalkBrandChannel.fee.js';

describe('카카오 채널 세팅비', () => {
  it('신청하면 입금 대기와 청구(공급가 90,000 · 부가세 9,000)가 생긴다', () => {
    const plan = planBrandChannelRequest({ setupFeeExcluded: false, grossKrw: 99000 });
    assert.equal(plan.status, 'PAYMENT_PENDING');
    assert.ok(plan.charge);
    assert.equal(plan.charge.supplyKrw, 90000);
    assert.equal(plan.charge.vatKrw, 9000);
    assert.match(setupFeeChargeLabel('한빛청소', plan.charge), /카카오 채널 세팅 · 한빛청소/);
    assert.match(setupFeeChargeLabel('한빛청소', plan.charge), /90,000/);
    assert.match(setupFeeChargeLabel('한빛청소', plan.charge), /9,000/);
  });

  it('입금완료면 연결 대기로 바뀐다', () => {
    assert.equal(brandChannelStatusAfterDeposit('PAYMENT_PENDING'), 'REQUESTED');
    assert.equal(brandChannelStatusAfterDeposit('LINKED'), null);
  });

  it('세팅비 제외면 바로 연결 대기이고 청구를 만들지 않는다', () => {
    const plan = planBrandChannelRequest({ setupFeeExcluded: true, grossKrw: 99000 });
    assert.equal(plan.status, 'REQUESTED');
    assert.equal(plan.charge, null);
  });

  it('부가세 포함 99,000원은 공급가 90,000원과 부가세 9,000원이다', () => {
    assert.deepEqual(splitVatInclusiveKrw(99000), { grossKrw: 99000, supplyKrw: 90000, vatKrw: 9000 });
  });
});
