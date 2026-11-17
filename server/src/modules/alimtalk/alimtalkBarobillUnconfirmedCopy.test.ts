import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  barobillChargeDecision,
  buildUnconfirmedMail,
  describeUnconfirmedStatus,
  publicCustomerName,
  publicInquiryNumber,
  publicTemplateTitle,
  sanitizeBarobillReason,
} from './alimtalkBarobillUnconfirmedCopy.js';

const names = {
  CBISEO_CUST_ORDER_DONE: '[고객] 예약(발주서) 접수 완료',
};

describe('barobillChargeDecision', () => {
  it('알림톡 성공은 대체문자 값이 대시여도 차감', () => {
    assert.equal(barobillChargeDecision(1, '-'), 'ata');
    assert.equal(barobillChargeDecision(1, ''), 'ata');
  });

  it('알림톡 실패 뒤 대체문자 대시·빈 값은 차감 없는 실패', () => {
    assert.equal(barobillChargeDecision(2, '-'), 'fail');
    assert.equal(barobillChargeDecision(2, ''), 'fail');
    assert.equal(barobillChargeDecision(2, '실패'), 'fail');
  });

  it('대체문자를 아직 보내면 기다린다', () => {
    assert.equal(barobillChargeDecision(2, '대기'), 'wait');
    assert.equal(barobillChargeDecision(0, '-'), 'wait');
  });
});

describe('결과 미확정 메일', () => {
  const sentAt = new Date('2026-11-16T09:02:00.000Z');

  it('한 업체 제목과 건별 본문에 코드·영문 상태를 넣지 않는다', () => {
    const status = describeUnconfirmedStatus({ found: true, sendStatus: 2, smsSendState: '-' });
    const mail = buildUnconfirmedMail({
      total: 1,
      tenantNames: ['테스트청소'],
      overflow: 0,
      memberBalanceKrw: 8200,
      items: [
        {
          tenantName: '테스트청소',
          templateName: publicTemplateTitle('CBISEO_CUST_ORDER_DONE', null, names),
          customerName: publicCustomerName('김민수'),
          maskedPhone: '010-****-5678',
          inquiryNumber: publicInquiryNumber('R-1001'),
          sentAt,
          statusLine: status.line,
          reason: sanitizeBarobillReason('잔액 부족 010-1234-5678 수신번호 821012345678') || status.defaultReason,
        },
      ],
    });

    assert.equal(mail.subject, '[청소비서] 알림톡 결과 미확정 1건 — 테스트청소');
    assert.match(mail.text, /테스트청소 · \[고객\] 예약\(발주서\) 접수 완료/);
    assert.match(mail.text, /받는 고객: 김민수 \(010-\*\*\*\*-5678\) · 접수번호 R-1001/);
    assert.match(mail.text, /보낸 시각: 11\. 16\. 18:02/);
    assert.match(mail.text, /상태: 알림톡 실패 → 대체문자 안 보냄/);
    assert.match(mail.text, /사유: 잔액 부족 수신번호/);
    assert.match(mail.text, /회원사 잔액 8,200원 — 대체문자를 못 보냈을 수 있어요/);
    assert.match(mail.text, /아직 차감되지 않았어요\./);
    assert.match(mail.text, /플랫폼 → 알림톡 → 발송 내역/);
    assert.match(mail.text, /업체 화면 → 알림톡 → 발송 로그/);
    assert.match(mail.text, /할 일: 바로빌 회원사 잔액 충전/);
    assert.doesNotMatch(mail.text, /CBISEO_/);
    assert.doesNotMatch(mail.text, /SendStatus|SmsSendState/);
    assert.doesNotMatch(mail.text, /010-1234-5678|821012345678/);
  });

  it('업체가 여럿이면 외 n곳, 20건을 넘으면 외 n건', () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      tenantName: index === 0 ? '한강청소' : '바다청소',
      templateName: '알림톡',
      customerName: '고객',
      maskedPhone: '010-****-0000',
      inquiryNumber: null,
      sentAt,
      statusLine: '바로빌에서 아직 보내는 중',
      reason: '바로빌에서 결과 통지가 아직 없습니다.',
    }));
    const mail = buildUnconfirmedMail({
      total: 22,
      tenantNames: ['한강청소', '바다청소'],
      items,
      overflow: 1,
      memberBalanceKrw: 12000,
    });
    assert.equal(mail.subject, '[청소비서] 알림톡 결과 미확정 22건 — 한강청소 외 1곳');
    assert.match(mail.text, /외 2건/);
    assert.equal(mail.text.split('한강청소 · 알림톡').length - 1, 1);
    assert.equal(mail.text.split('바다청소 · 알림톡').length - 1, 19);
    assert.doesNotMatch(mail.text, /회원사 잔액|할 일/);
  });

  it('조회가 안 되면 결과 없음, 바이트 표식은 사유로 쓰지 않는다', () => {
    const missed = describeUnconfirmedStatus({ found: false, sendStatus: null, smsSendState: null });
    assert.equal(missed.line, '바로빌에서 결과를 찾지 못함');
    assert.equal(sanitizeBarobillReason('sms-bytes:84'), '');
    const pending = describeUnconfirmedStatus({ found: true, sendStatus: 0, smsSendState: '' });
    assert.equal(pending.line, '바로빌에서 아직 보내는 중');
    const sending = describeUnconfirmedStatus({ found: true, sendStatus: 2, smsSendState: '전송중' });
    assert.equal(sending.line, '알림톡 실패 → 대체문자 보내는 중');
  });
});
