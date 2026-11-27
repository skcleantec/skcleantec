import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { BarobillCallError } from '../../lib/barobill/soap.js';
import {
  BAROBILL_SMS_PERMISSION_CODES,
  BAROBILL_SMS_PERMISSION_HOLD_MS,
  clearedSmsFallback,
  resetBarobillSmsPermissionWindow,
  sendWithSmsPermissionRetry,
  setBarobillSmsPermissionClockForTests,
} from '../../lib/barobill/kakaotalkSmsPermission.js';
import { commitBarobillSendLog } from './alimtalkBarobillSend.js';
import { prepareBarobillMessage } from './alimtalkBarobillMessage.js';

const PERMISSION = new BarobillCallError(
  -1,
  '문자서비스 권한이 없는 아이디입니다. 먼저 권한을 신청해 주세요.',
);
const BALANCE = new BarobillCallError(-26006, '바로빌 잔액이 부족합니다.');

type Attempt = { omitSmsFallback: boolean };

function permissionCode(): number {
  return [...BAROBILL_SMS_PERMISSION_CODES][0] ?? -1;
}

afterEach(() => {
  resetBarobillSmsPermissionWindow();
  setBarobillSmsPermissionClockForTests(null);
});

type StoredLog = {
  id: string;
  chargeStatus: string;
  barobillSendKey?: string;
  writes: number;
};

/** 결과 조회가 성공 기록 1건만 차감한다고 가정한 횟수. */
function chargesFor(rows: StoredLog[]): number {
  return rows.filter((row) => row.chargeStatus === 'AWAITING_RESULT' && row.barobillSendKey).length;
}

async function recordOnce(send: () => Promise<{ sendKey: string; omittedSmsFallback: boolean }>) {
  const rows: StoredLog[] = [{ id: 'log-1', chargeStatus: 'PENDING', writes: 0 }];
  let omittedMails = 0;
  const result = await commitBarobillSendLog({
    pendingId: rows[0].id,
    smsBytes: 12,
    update: async (data) => {
      rows[0].chargeStatus = data.chargeStatus;
      if (data.barobillSendKey) rows[0].barobillSendKey = data.barobillSendKey;
      rows[0].writes += 1;
    },
    send,
    notifyOmitted: async () => {
      omittedMails += 1;
    },
    notifyBalance: async () => {},
  });
  return { rows, result, omittedMails, charges: chargesFor(rows) };
}

describe('바로빌 문자 권한', () => {
  it('권한 오류면 대체문자 없이 한 번 다시 보내고 성공 기록·차감은 1건', async () => {
    const calls: Attempt[] = [];
    const recorded = await recordOnce(() =>
      sendWithSmsPermissionRetry(async (omitSmsFallback) => {
        calls.push({ omitSmsFallback });
        if (!omitSmsFallback) throw PERMISSION;
        const cleared = clearedSmsFallback();
        assert.equal(cleared.SmsReply, 'N');
        assert.equal(cleared.SmsSenderNum, '');
        assert.equal(cleared.SmsSubject, '');
        assert.equal(cleared.SmsMessage, '');
        return 'send-key-1';
      }).then((accepted) => ({ sendKey: accepted.value, omittedSmsFallback: accepted.omittedSmsFallback })),
    );

    assert.deepEqual(calls, [{ omitSmsFallback: false }, { omitSmsFallback: true }]);
    assert.equal(recorded.result.ok, true);
    assert.equal(recorded.rows.length, 1);
    assert.equal(recorded.rows[0].writes, 1);
    assert.equal(recorded.rows[0].chargeStatus, 'AWAITING_RESULT');
    assert.equal(recorded.rows[0].barobillSendKey, 'send-key-1');
    assert.equal(recorded.charges, 1);
    assert.equal(recorded.omittedMails, 1);
  });

  it('잔액 부족 등 다른 오류는 다시 보내지 않는다', async () => {
    const calls: Attempt[] = [];
    const recorded = await recordOnce(() =>
      sendWithSmsPermissionRetry(async (omitSmsFallback) => {
        calls.push({ omitSmsFallback });
        throw BALANCE;
      }).then((accepted) => ({ sendKey: accepted.value, omittedSmsFallback: accepted.omittedSmsFallback })),
    );
    assert.deepEqual(calls, [{ omitSmsFallback: false }]);
    assert.equal(recorded.result.ok, false);
    assert.equal(recorded.rows.length, 1);
    assert.equal(recorded.rows[0].chargeStatus, 'FAILED');
    assert.equal(recorded.charges, 0);
    assert.equal(recorded.omittedMails, 0);
  });

  it('다시 보내도 실패하면 실패 기록은 1건이고 차감하지 않는다', async () => {
    const calls: Attempt[] = [];
    const recorded = await recordOnce(() =>
      sendWithSmsPermissionRetry(async (omitSmsFallback) => {
        calls.push({ omitSmsFallback });
        throw PERMISSION;
      }).then((accepted) => ({ sendKey: accepted.value, omittedSmsFallback: accepted.omittedSmsFallback })),
    );
    assert.deepEqual(calls, [{ omitSmsFallback: false }, { omitSmsFallback: true }]);
    assert.equal(recorded.result.ok, false);
    assert.equal(recorded.rows.length, 1);
    assert.equal(recorded.rows[0].writes, 1);
    assert.equal(recorded.rows[0].chargeStatus, 'FAILED');
    assert.equal(recorded.rows[0].barobillSendKey, undefined);
    assert.equal(recorded.charges, 0);
  });

  it('오류 코드만 있어도 한 번만 다시 보낸다', async () => {
    const calls: boolean[] = [];
    const accepted = await sendWithSmsPermissionRetry(async (omitSmsFallback) => {
      calls.push(omitSmsFallback);
      if (!omitSmsFallback) throw new BarobillCallError(-10194, '');
      return 'send-key-code';
    });
    assert.deepEqual(calls, [false, true]);
    assert.equal(accepted.omittedSmsFallback, true);
    assert.equal(accepted.value, 'send-key-code');
  });

  it('10분 안에는 처음부터 대체문자 없이 보내고, 10분이 지나면 다시 붙여 본다', async () => {
    let now = 1_700_000_000_000;
    setBarobillSmsPermissionClockForTests(() => now);
    const calls: Attempt[] = [];
    const send = () =>
      sendWithSmsPermissionRetry(async (omitSmsFallback) => {
        calls.push({ omitSmsFallback });
        if (!omitSmsFallback) throw new BarobillCallError(permissionCode(), PERMISSION.detail);
        return 'key';
      });

    await send();
    calls.length = 0;
    await send();
    assert.deepEqual(calls, [{ omitSmsFallback: true }]);

    now += BAROBILL_SMS_PERMISSION_HOLD_MS;
    calls.length = 0;
    await send();
    assert.deepEqual(calls, [{ omitSmsFallback: false }, { omitSmsFallback: true }]);
  });
});

describe('prepareBarobillMessage 대체문자', () => {
  const template = {
    barobillContent: '안녕하세요 #{고객명}',
    barobillTitle: null,
    barobillButtonsJson: null,
    barobillSmsSubject: '',
    barobillSmsMessage: '',
  };

  it('대체문자를 보낼 때는 제목·본문이 없으면 막는다', () => {
    const prepared = prepareBarobillMessage(template, { '#{고객명}': '김청소' });
    assert.equal(prepared.ok, false);
  });

  it('대체문자 없이 보낼 때는 제목·본문 검사를 건너뛴다', () => {
    const prepared = prepareBarobillMessage(template, { '#{고객명}': '김청소' }, { omitSmsFallback: true });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.equal(prepared.message.smsSubject, '');
    assert.equal(prepared.message.smsMessage, '');
    assert.equal(prepared.message.message, '안녕하세요 김청소');
  });
});
