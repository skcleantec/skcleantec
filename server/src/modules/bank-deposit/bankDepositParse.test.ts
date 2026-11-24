import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accountMasksMatch, parseBankDeposit } from './bankDepositParse.js';

const received = new Date('2026-11-24T00:10:00.000Z');

describe('농협 입금 문자', () => {
  it('웹발신·줄바꿈·쉼표·잔액을 해석하고 잔액은 남기지 않는다', () => {
    const parsed = parseBankDeposit(
      '[Web발신]\n-농협 입금20,000원\n11/24 09:04 301-****-9047-01 김예시 잔액4,041,585원',
      received,
    );
    assert.ok(parsed);
    assert.equal(parsed.bankName, '농협');
    assert.equal(parsed.amountWon, 20000);
    assert.equal(parsed.accountMask, '301-****-9047-01');
    assert.equal(parsed.depositorName, '김예시');
    assert.equal(parsed.depositedAt.toISOString(), '2026-11-24T00:04:00.000Z');
    assert.equal(parsed.rawText.includes('잔액'), false);
    assert.equal(parsed.rawText.includes('4,041,585'), false);
  });

  it('한 줄이고 잔액이 없어도 읽는다', () => {
    const parsed = parseBankDeposit('-농협 입금20000원 11/24 09:04 301-****-9047-01 김예시', received);
    assert.equal(parsed?.amountWon, 20000);
    assert.equal(parsed?.depositorName, '김예시');
  });

  it('입금자명에 공백·영문·괄호가 있어도 이름만 남긴다', () => {
    const parsed = parseBankDeposit(
      '-농협 입금15,000원\n11/24 09:04 301-****-9047-01 Kim (Hong) Gil',
      received,
    );
    assert.equal(parsed?.depositorName, 'Kim (Hong) Gil');
  });

  it('출금·이체·결제는 입금으로 보지 않는다', () => {
    assert.equal(parseBankDeposit('-농협 출금20,000원\n11/24 09:04 301-****-9047-01 김예시', received), null);
    assert.equal(parseBankDeposit('-농협 이체20,000원\n11/24 09:04 301-****-9047-01 김예시', received), null);
    assert.equal(parseBankDeposit('농협 결제 20,000원\n11/24 09:04 301-****-9047-01 김예시', received), null);
  });

  it('12월 문자를 1월에 받으면 전년으로 잡는다', () => {
    const january = new Date('2026-01-02T00:30:00+09:00');
    const parsed = parseBankDeposit('-농협 입금10,000원\n12/31 23:50 301-****-9047-01 김예시', january);
    assert.equal(parsed?.depositedAt.toISOString(), '2025-12-31T14:50:00.000Z');
  });

  it('끝자리만 등록된 계좌도 같은 계좌로 본다', () => {
    assert.equal(accountMasksMatch('9047-01', '301-****-9047-01'), true);
    assert.equal(accountMasksMatch('301-****-1111-01', '301-****-9047-01'), false);
  });
});
