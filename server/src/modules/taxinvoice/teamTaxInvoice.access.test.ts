import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teamTaxInvoiceReasonRequired, teamTaxInvoiceTabVisible } from './teamTaxInvoice.access.js';

describe('team tax invoice', () => {
  it('이미 발행했거나 총액을 넘으면 사유가 필요하다', () => {
    assert.equal(teamTaxInvoiceReasonRequired({ alreadyIssued: true, amount: 1000, total: 5000 }), true);
    assert.equal(teamTaxInvoiceReasonRequired({ alreadyIssued: false, amount: 6000, total: 5000 }), true);
    assert.equal(teamTaxInvoiceReasonRequired({ alreadyIssued: false, amount: 4000, total: 5000 }), false);
  });

  it('세금계산서 기능이 꺼지면 탭을 숨긴다', () => {
    assert.equal(teamTaxInvoiceTabVisible(false), false);
    assert.equal(teamTaxInvoiceTabVisible(true), true);
  });
});
