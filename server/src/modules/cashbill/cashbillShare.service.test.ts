import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cashbillShareCancelled, cashbillShareLink, cashbillShareTokenOk } from './cashbillShare.service.js';
import { teamCashbillCanShare } from './teamCashbill.access.js';

describe('cashbill share link', () => {
  it('짧은 토큰만 받고 다른 글자는 거절한다', () => {
    assert.equal(cashbillShareTokenOk(`c${'a'.repeat(24)}`), true);
    assert.equal(cashbillShareTokenOk('cshort'), false);
    assert.equal(cashbillShareTokenOk('t' + 'a'.repeat(24)), false);
    assert.equal(cashbillShareTokenOk(`c${'a'.repeat(24)}/../x`), false);
  });

  it('청소비서 주소로만 링크를 만든다', () => {
    const token = `c${'a'.repeat(24)}`;
    const link = cashbillShareLink(token);
    assert.equal(link.endsWith(`/r/c/${token}`), true);
    assert.equal(link.startsWith('https://'), true);
  });

  it('취소 건과 취소가 끝난 건은 영수증으로 넘기지 않는다', () => {
    assert.equal(cashbillShareCancelled('CANCEL', []), true);
    assert.equal(cashbillShareCancelled('FULL', [{ barobillState: '3000' }]), true);
    assert.equal(cashbillShareCancelled('FULL', [{ barobillState: '1000' }]), false);
    assert.equal(cashbillShareCancelled('FULL', []), false);
  });
});

describe('team cashbill share access', () => {
  it('본인 발행이거나 본인 배정 접수만 보낸다', () => {
    assert.equal(teamCashbillCanShare({ issuedByMe: true, assignedInquiry: false }), true);
    assert.equal(teamCashbillCanShare({ issuedByMe: false, assignedInquiry: true }), true);
    assert.equal(teamCashbillCanShare({ issuedByMe: false, assignedInquiry: false }), false);
  });
});
