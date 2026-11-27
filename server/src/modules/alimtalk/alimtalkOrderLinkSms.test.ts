import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ORDER_LINK_SMS_COOLDOWN_ERROR,
  judgeOrderLinkSend,
  orderLinkSmsAvailable,
  orderLinkSmsCooldownError,
  renderOrderLinkFallbackSms,
  runOrderLinkSmsDelivery,
} from './alimtalkOrderLinkSms.js';

const at = new Date('2026-11-27T01:00:00.000Z');

describe('발주 안내 발송 상태', () => {
  it('접수 후 결과 대기는 awaiting', () => {
    const info = judgeOrderLinkSend({
      chargeStatus: 'AWAITING_RESULT',
      deliveredChannel: null,
      createdAt: at,
      finalizedAt: null,
      errorMessage: null,
      resultMessage: 'sms-bytes:40',
    });
    assert.equal(info?.status, 'awaiting');
    assert.equal(info?.at, at.toISOString());
    assert.equal(info?.message, null);
  });

  it('알림톡 도착은 delivered', () => {
    const info = judgeOrderLinkSend({
      chargeStatus: 'PAID',
      deliveredChannel: 'ATA',
      createdAt: at,
      finalizedAt: at,
      errorMessage: null,
      resultMessage: null,
    });
    assert.equal(info?.status, 'delivered');
    assert.equal(info?.channel, 'ATA');
  });

  it('문자로 나간 건은 sms_sent', () => {
    const auto = judgeOrderLinkSend({
      chargeStatus: 'FREE',
      deliveredChannel: 'LMS',
      createdAt: at,
      finalizedAt: at,
      errorMessage: null,
      resultMessage: null,
    });
    const manual = judgeOrderLinkSend({
      chargeStatus: 'PAID',
      deliveredChannel: 'SMS',
      createdAt: at,
      finalizedAt: at,
      errorMessage: null,
      resultMessage: null,
    });
    assert.equal(auto?.status, 'sms_sent');
    assert.equal(manual?.status, 'sms_sent');
    assert.equal(manual?.channel, 'SMS');
  });

  it('실패는 failed 이고 바로빌이라는 말을 빼 둔다', () => {
    const info = judgeOrderLinkSend({
      chargeStatus: 'FAILED',
      deliveredChannel: null,
      createdAt: at,
      finalizedAt: at,
      errorMessage: '바로빌 오류 문자서비스 권한이 없습니다.',
      resultMessage: null,
    });
    assert.equal(info?.status, 'failed');
    assert.match(info?.message ?? '', /발송 서비스/);
    assert.equal(info?.message?.includes('바로빌'), false);
  });
});

describe('문자 가능 여부와 중복', () => {
  it('연락처가 없거나 형식이 틀리면 문자로 보낼 수 없다', () => {
    assert.equal(orderLinkSmsAvailable(null), false);
    assert.equal(orderLinkSmsAvailable(''), false);
    assert.equal(orderLinkSmsAvailable('123'), false);
    assert.equal(orderLinkSmsAvailable('01012345678'), true);
  });

  it('60초 안에 다시 누르면 보내지 않는다', () => {
    const now = new Date('2026-11-27T01:00:30.000Z');
    assert.equal(orderLinkSmsCooldownError(new Date('2026-11-27T01:00:00.000Z'), now), ORDER_LINK_SMS_COOLDOWN_ERROR);
    assert.equal(orderLinkSmsCooldownError(new Date('2026-11-27T00:59:00.000Z'), now), null);
  });
});

describe('문자 문구와 과금', () => {
  const template = {
    subject: '[안내] #{고객명}',
    body: '#{고객명}님, 예약 안내입니다. 발주서 https://www.cbiseo.com/order/#{발주토큰}?tenant=#{업체코드}&brand=#{브랜드코드}',
  };
  const variables = {
    '#{고객명}': '김청소',
    '#{발주토큰}': 'tok',
    '#{업체코드}': 'cbiseo',
    '#{브랜드코드}': 'cbiseo',
  };

  it('미리보기 문구와 실제 발송 문구가 같다', async () => {
    const preview = renderOrderLinkFallbackSms(template, variables);
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    let sent: { subject: string; body: string } | null = null;
    const result = await runOrderLinkSmsDelivery({
      now: at,
      recentSentAt: null,
      message: preview.message,
      send: async (message) => {
        sent = { subject: message.subject, body: message.body };
        return 'receipt-1';
      },
      charge: async () => ({ chargeStatus: 'PAID', chargedKrw: 60, freeUnitsConsumed: 0 }),
    });
    assert.equal(result.ok, true);
    assert.equal(sent?.subject, preview.message.subject);
    assert.equal(sent?.body, preview.message.body);
    assert.match(preview.message.body, /김청소/);
  });

  it('성공하면 한 번만 차감하고 실패하면 차감하지 않는다', async () => {
    const message = { subject: '제목', body: '본문', kind: 'LMS' as const };
    let charges = 0;
    const ok = await runOrderLinkSmsDelivery({
      now: at,
      recentSentAt: null,
      message,
      send: async () => 'receipt-1',
      charge: async () => {
        charges += 1;
        return { chargeStatus: 'PAID', chargedKrw: 60, freeUnitsConsumed: 0 };
      },
    });
    assert.equal(ok.ok, true);
    assert.equal(charges, 1);

    const failed = await runOrderLinkSmsDelivery({
      now: at,
      recentSentAt: null,
      message,
      send: async () => {
        throw new Error('바로빌 잔액이 부족합니다.');
      },
      charge: async () => {
        charges += 1;
        return { chargeStatus: 'PAID', chargedKrw: 60, freeUnitsConsumed: 0 };
      },
    });
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.equal(failed.error.includes('바로빌'), false);
    assert.equal(charges, 1);
  });
});
