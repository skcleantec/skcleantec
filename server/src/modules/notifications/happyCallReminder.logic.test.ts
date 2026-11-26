import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  happyCallCronPreferredDateRange,
  isHappyCallInHourlyReminderWindow,
  isHappyCallOverdue,
  isHappyCallPushGapElapsed,
} from '../inquiries/happyCall.helpers.js';
import {
  buildHappyCallPushPayload,
  staffAppAndroidNotificationExtras,
  staffAppPushDataRecord,
} from '../../lib/staffAppPush.helpers.js';
import { teamDepositPushPayload } from '../bank-deposit/bankDepositTeam.push.js';
import { staffChangePushUserIds } from '../realtime/changeLogNotify.js';

const workDay = new Date('2026-11-26T10:00:00+09:00');
const createdBefore = new Date('2026-11-20T10:00:00+09:00');

function inWindow(nowIso: string, completedAt: Date | null = null): boolean {
  return isHappyCallInHourlyReminderWindow(
    new Date(nowIso),
    workDay,
    completedAt,
    'RECEIVED',
    createdBefore,
  );
}

describe('해피콜 푸시 창', () => {
  it('전날 17:59 는 보내지 않고 18:00 부터 보낸다', () => {
    assert.equal(inWindow('2026-11-25T17:59:00+09:00'), false);
    assert.equal(inWindow('2026-11-25T18:00:00+09:00'), true);
  });

  it('전날 23:59 까지 보내고 작업 당일 00:00 부터는 보내지 않는다', () => {
    assert.equal(inWindow('2026-11-25T23:59:00+09:00'), true);
    assert.equal(inWindow('2026-11-25T23:59:59.999+09:00'), true);
    assert.equal(inWindow('2026-11-26T00:00:00+09:00'), false);
  });

  it('완료되면 창 안이라도 보내지 않는다', () => {
    assert.equal(inWindow('2026-11-25T19:00:00+09:00', new Date('2026-11-25T18:30:00+09:00')), false);
  });

  it('작업 당일에는 푸시를 보내지 않아도 미완으로 남는다', () => {
    const jobMorning = new Date('2026-11-26T09:00:00+09:00');
    assert.equal(inWindow('2026-11-26T09:00:00+09:00'), false);
    assert.equal(
      isHappyCallOverdue(jobMorning, workDay, null, 'RECEIVED', createdBefore),
      true,
    );
  });

  it('18:00 전에는 조회 대상이 없고, 18:00 이후에는 내일 작업만 본다', () => {
    assert.equal(happyCallCronPreferredDateRange(new Date('2026-11-25T17:59:00+09:00')), null);
    const atSix = happyCallCronPreferredDateRange(new Date('2026-11-25T18:00:00+09:00'));
    const atLate = happyCallCronPreferredDateRange(new Date('2026-11-25T23:59:00+09:00'));
    assert.equal(atSix?.gte.toISOString(), new Date('2026-11-26T00:00:00+09:00').toISOString());
    assert.equal(atSix?.lte.toISOString(), new Date('2026-11-26T23:59:59.999+09:00').toISOString());
    assert.equal(atLate?.gte.toISOString(), atSix?.gte.toISOString());
    assert.equal(happyCallCronPreferredDateRange(new Date('2026-11-26T00:00:00+09:00')), null);
  });
});

describe('해피콜 55분 간격', () => {
  const sent = new Date('2026-11-25T18:55:00+09:00');

  it('18:55 발송 후 19:05 에는 보내지 않는다', () => {
    assert.equal(isHappyCallPushGapElapsed(new Date('2026-11-25T19:05:00+09:00'), sent), false);
  });

  it('18:55 발송 후 19:50 에는 보낸다', () => {
    assert.equal(isHappyCallPushGapElapsed(new Date('2026-11-25T19:50:00+09:00'), sent), true);
  });
});

describe('알림 tag', () => {
  it('해피콜은 접수별 tag 를 데이터와 안드로이드 알림에 넣는다', () => {
    const payload = buildHappyCallPushPayload({
      customerName: '고객',
      inquiryId: 'inq-1',
      variant: 'reminder',
    });
    assert.equal(payload.tag, 'happy_call:inq-1');
    const data = staffAppPushDataRecord(payload);
    assert.equal(data.tag, 'happy_call:inq-1');
    assert.deepEqual(staffAppAndroidNotificationExtras(data), { tag: 'happy_call:inq-1' });
  });

  it('입금 확인 재알림만 입금 건 tag 를 갖고, 첫 알림은 tag 가 없다', () => {
    const reminder = teamDepositPushPayload({
      userId: 'leader',
      tenantId: 'tenant',
      title: '누구 고객 입금인지 확인해 주세요',
      body: '1원',
      path: '/team/assignments',
      depositId: 'dep-1',
    });
    assert.equal(reminder.tag, 'bank_deposit:dep-1');
    const first = teamDepositPushPayload({
      userId: 'leader',
      tenantId: 'tenant',
      title: '잔금이 입금됐어요',
      body: '1원',
      path: '/team/assignments',
    });
    assert.equal(first.tag, undefined);
    assert.deepEqual(staffAppAndroidNotificationExtras(staffAppPushDataRecord(first)), {});
  });
});

describe('본인 제외와 배정 푸시', () => {
  it('고친 사람은 휴대폰 푸시 대상에서 빠진다', () => {
    assert.deepEqual(
      staffChangePushUserIds(['leader', 'actor'], { actorId: 'actor' }),
      ['leader'],
    );
  });

  it('새로 배정된 팀장에게는 변경 푸시를 보내지 않는다', () => {
    assert.deepEqual(
      staffChangePushUserIds(['old-leader', 'new-leader'], {
        actorId: 'admin',
        suppressChangePushUserIds: ['new-leader'],
      }),
      ['old-leader'],
    );
    assert.deepEqual(
      staffChangePushUserIds(['new-leader'], {
        actorId: 'admin',
        suppressChangePushUserIds: ['new-leader'],
      }),
      [],
    );
  });
});
