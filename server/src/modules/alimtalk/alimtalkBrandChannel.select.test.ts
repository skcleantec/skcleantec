import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseAlimtalkSendChannel } from './alimtalkBrandChannel.select.js';

const approved = { status: 'APPROVED', providerTemplateName: '[고객] 발주서 작성·예약 안내' };
const reviewing = { status: 'IN_REVIEW', providerTemplateName: '[고객] 발주서 작성·예약 안내' };

describe('알림톡 발송 채널 선택', () => {
  it('채널 없음', () => {
    const choice = chooseAlimtalkSendChannel({ channel: null, template: null });
    assert.equal(choice.route, 'platform');
  });

  it('채널 있음·서식 심사 중', () => {
    const choice = chooseAlimtalkSendChannel({
      channel: { status: 'LINKED', providerChannelId: '@brand' },
      template: reviewing,
    });
    assert.equal(choice.route, 'platform');
  });

  it('서식 승인', () => {
    const choice = chooseAlimtalkSendChannel({
      channel: { status: 'ACTIVE', providerChannelId: '@brand' },
      template: approved,
    });
    assert.deepEqual(choice, {
      route: 'brand',
      channelId: '@brand',
      templateName: '[고객] 발주서 작성·예약 안내',
    });
  });

  it('채널 끊김', () => {
    const choice = chooseAlimtalkSendChannel({
      channel: { status: 'DISCONNECTED', providerChannelId: '@brand' },
      template: approved,
    });
    assert.equal(choice.route, 'platform');
  });
});
