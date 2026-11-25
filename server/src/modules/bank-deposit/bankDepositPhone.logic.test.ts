import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  heartbeatWrite,
  phoneAlertTick,
  pickPhoneAlert,
  shouldSendPhoneAlert,
  type HeartbeatPrevious,
  type PhoneDevice,
} from './bankDepositPhone.logic.js';

const now = new Date('2026-11-24T09:00:00.000Z');
const blank: HeartbeatPrevious = {
  listenerDownSince: null,
  noticeOffSince: null,
  keepAliveOffSince: null,
};

function device(patch: Partial<PhoneDevice> = {}): PhoneDevice {
  return {
    id: 'phone-1',
    createdAt: new Date('2026-11-24T00:00:00.000Z'),
    lastSeenAt: new Date(now.getTime() - 60_000),
    statusAt: new Date(now.getTime() - 60_000),
    listenerConnected: true,
    noticeAccessEnabled: true,
    keepAliveRunning: true,
    listenerDownSince: null,
    noticeOffSince: null,
    keepAliveOffSince: null,
    alertPushCode: null,
    alertPushAt: null,
    alertRecoveredAt: null,
    ...patch,
  };
}

describe('입금 알림 폰 상태', () => {
  it('예전 빈 heartbeat 는 상태를 덮지 않는다', () => {
    assert.deepEqual(heartbeatWrite({}, blank, now), {});
    assert.deepEqual(heartbeatWrite({ extra: true }, blank, now), {});
  });

  it('새 본문의 상태와 앱 버전과 카운터를 저장한다', () => {
    const noticed = new Date('2026-11-24T08:30:00.000Z');
    const write = heartbeatWrite(
      {
        appVersion: '0.1.7',
        listenerConnected: false,
        noticeAccessEnabled: true,
        keepAliveRunning: true,
        batteryUnrestricted: false,
        lastNoticeAt: noticed.getTime(),
        counters: { posts: 3, extracted: 2, deposits: 1, missed: 0, rebinds: 4, sent: 1, secret: 9 },
        ignored: 'nope',
      },
      blank,
      now,
    );
    assert.equal(write.appVersion, '0.1.7');
    assert.equal(write.listenerConnected, false);
    assert.equal(write.noticeAccessEnabled, true);
    assert.equal(write.keepAliveRunning, true);
    assert.equal(write.batteryUnrestricted, false);
    assert.equal(write.lastNoticeAt?.toISOString(), noticed.toISOString());
    assert.deepEqual(write.counters, { posts: 3, extracted: 2, deposits: 1, missed: 0, rebinds: 4, sent: 1 });
    assert.equal(write.statusAt?.toISOString(), now.toISOString());
    assert.equal(write.listenerDownSince?.toISOString(), now.toISOString());
    assert.equal(write.noticeOffSince, null);
    assert.equal('ignored' in write, false);

    const again = heartbeatWrite(
      { listenerConnected: false, noticeAccessEnabled: true },
      { ...blank, listenerDownSince: new Date('2026-11-24T08:00:00.000Z') },
      now,
    );
    assert.equal(again.listenerDownSince?.toISOString(), '2026-11-24T08:00:00.000Z');
    assert.equal(heartbeatWrite({ lastNoticeAt: 0 }, blank, now).lastNoticeAt, null);
  });

  it('phoneAlert 다섯 경우와 정상', () => {
    const healthy = pickPhoneAlert([device()], now);
    assert.equal(healthy.alert, null);

    const listening = pickPhoneAlert(
      [device({ listenerConnected: false, listenerDownSince: new Date(now.getTime() - 3 * 60_000 - 1) })],
      now,
    );
    assert.equal(listening.alert?.level, 'error');
    assert.equal(listening.alert?.code, 'NOT_LISTENING');
    assert.equal(listening.alert?.since, new Date(now.getTime() - 3 * 60_000 - 1).toISOString());
    assert.equal(
      pickPhoneAlert(
        [device({ listenerConnected: false, listenerDownSince: new Date(now.getTime() - 3 * 60_000) })],
        now,
      ).alert,
      null,
    );

    const access = pickPhoneAlert(
      [device({ noticeAccessEnabled: false, noticeOffSince: new Date('2026-11-24T08:10:00.000Z') })],
      now,
    );
    assert.equal(access.alert?.code, 'NO_ACCESS');
    assert.equal(access.alert?.level, 'error');
    assert.equal(access.alert?.since, '2026-11-24T08:10:00.000Z');

    const alive = pickPhoneAlert(
      [device({ keepAliveRunning: false, keepAliveOffSince: new Date('2026-11-24T08:20:00.000Z') })],
      now,
    );
    assert.equal(alive.alert?.code, 'KEEPALIVE_OFF');
    assert.equal(alive.alert?.level, 'warn');

    const silentAt = new Date(now.getTime() - 13 * 60_000);
    const silent = pickPhoneAlert([device({ lastSeenAt: silentAt, listenerConnected: false })], now);
    assert.equal(silent.alert?.code, 'SILENT');
    assert.equal(silent.alert?.level, 'error');
    assert.equal(silent.alert?.since, new Date(silentAt.getTime() + 13 * 60_000).toISOString());
    assert.equal(pickPhoneAlert([device({ lastSeenAt: new Date(now.getTime() - 12 * 60_000) })], now).alert, null);

    const old = pickPhoneAlert([device({ statusAt: null, listenerConnected: null })], now);
    assert.equal(old.alert?.code, 'OLD_APP');
    assert.equal(old.alert?.level, 'warn');
    assert.equal(old.alert?.since, '2026-11-24T00:00:00.000Z');
  });

  it('같은 문제는 1시간에 한 번만 알린다', () => {
    const error = pickPhoneAlert(
      [device({ noticeAccessEnabled: false, noticeOffSince: new Date('2026-11-24T08:10:00.000Z') })],
      now,
    ).alert;
    assert.equal(shouldSendPhoneAlert([device()], error, now), true);
    const recent = device({ alertPushCode: 'NO_ACCESS', alertPushAt: new Date(now.getTime() - 30 * 60_000) });
    assert.equal(shouldSendPhoneAlert([recent], error, now), false);
    const hourAgo = device({ alertPushCode: 'NO_ACCESS', alertPushAt: new Date(now.getTime() - 60 * 60_000) });
    assert.equal(shouldSendPhoneAlert([hourAgo], error, now), true);
    const other = device({ alertPushCode: 'SILENT', alertPushAt: new Date(now.getTime() - 5 * 60_000) });
    assert.equal(shouldSendPhoneAlert([other], error, now), true);
    const warn = pickPhoneAlert([device({ statusAt: null })], now).alert;
    assert.equal(shouldSendPhoneAlert([device()], warn, now), false);
    assert.equal(shouldSendPhoneAlert([device()], null, now), false);
  });

  it('상태 있는 폰은 12분, 예전 빈 heartbeat 폰은 20분이 넘으면 끊긴다', () => {
    assert.deepEqual(heartbeatWrite({}, blank, now), {});
    assert.equal(pickPhoneAlert([device({ lastSeenAt: new Date(now.getTime() - 12 * 60_000) })], now).alert, null);
    const late = new Date(now.getTime() - 13 * 60_000);
    const freshSilent = pickPhoneAlert([device({ lastSeenAt: late })], now);
    assert.equal(freshSilent.alert?.code, 'SILENT');
    assert.equal(freshSilent.alert?.since, new Date(late.getTime() + 13 * 60_000).toISOString());

    const oldSeen = { statusAt: null, listenerConnected: null, noticeAccessEnabled: null, keepAliveRunning: null };
    assert.equal(pickPhoneAlert([device({ ...oldSeen, lastSeenAt: new Date(now.getTime() - 12 * 60_000) })], now).alert?.code, 'OLD_APP');
    assert.equal(pickPhoneAlert([device({ ...oldSeen, lastSeenAt: new Date(now.getTime() - 20 * 60_000) })], now).alert?.code, 'OLD_APP');
    const oldLate = new Date(now.getTime() - 21 * 60_000);
    const oldSilent = pickPhoneAlert([device({ ...oldSeen, lastSeenAt: oldLate })], now);
    assert.equal(oldSilent.alert?.code, 'SILENT');
    assert.equal(oldSilent.alert?.since, new Date(oldLate.getTime() + 21 * 60_000).toISOString());
  });

  it('화면을 열지 않아도 끊기면 알리고, 다시 연결되면 한 번만 알린다', () => {
    const silent = device({ lastSeenAt: new Date(now.getTime() - 13 * 60_000) });
    const first = phoneAlertTick([silent], now);
    assert.equal(first.sendError, true);
    assert.equal(first.alert?.code, 'SILENT');
    assert.equal(first.recoverDeviceId, null);

    const held = device({
      lastSeenAt: new Date(now.getTime() - 13 * 60_000),
      alertPushCode: 'SILENT',
      alertPushAt: new Date(now.getTime() - 5 * 60_000),
    });
    assert.equal(phoneAlertTick([held], now).sendError, false);

    const back = phoneAlertTick(
      [device({ alertPushCode: 'SILENT', alertPushAt: new Date(now.getTime() - 10 * 60_000) })],
      now,
    );
    assert.equal(back.alert, null);
    assert.equal(back.sendError, false);
    assert.equal(back.recoverDeviceId, 'phone-1');

    const again = phoneAlertTick(
      [device({
        alertPushCode: 'SILENT',
        alertPushAt: new Date(now.getTime() - 10 * 60_000),
        alertRecoveredAt: new Date(now.getTime() - 60_000),
      })],
      now,
    );
    assert.equal(again.recoverDeviceId, null);
    assert.equal(phoneAlertTick([device()], now).recoverDeviceId, null);
  });
});
