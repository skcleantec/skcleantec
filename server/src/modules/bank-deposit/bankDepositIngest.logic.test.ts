import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bankDepositFeatureDisabledBody } from './bankDepositGuard.js';
import {
  depositFingerprint,
  normalizeContentHash,
  pickDuplicate,
  rescanBody,
  resolveUnparsedWhere,
  unparsedRecord,
  type DepositKeyRow,
} from './bankDepositIngest.logic.js';
import { teamMobilePushAllowed } from './bankDepositTeam.logic.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const at = new Date('2026-11-24T00:04:00.000Z');

function row(partial: Partial<DepositKeyRow> & Pick<DepositKeyRow, 'id' | 'dedupeKey'>): DepositKeyRow {
  return {
    contentHash: null,
    fingerprint: depositFingerprint({
      accountMask: '301-****-9047-01',
      amountWon: 230000,
      depositorName: '김예시',
      depositedAt: at,
    }),
    ...partial,
  };
}

function apply(rows: DepositKeyRow[], incoming: { dedupeKey: string; contentHash: string | null; fingerprint: string }) {
  const decision = pickDuplicate(incoming, rows);
  if (!decision.duplicate) {
    rows.push({ id: `new-${rows.length + 1}`, ...incoming });
    return rows;
  }
  if (decision.fillHashOnId) {
    const target = rows.find((item) => item.id === decision.fillHashOnId);
    if (target && target.contentHash == null) target.contentHash = incoming.contentHash;
  }
  return rows;
}

describe('입금 중복', () => {
  const fingerprint = depositFingerprint({
    accountMask: '301-****-9047-01',
    amountWon: 230000,
    depositorName: '김예시',
    depositedAt: at,
  });

  it('지문은 계좌·금액·이름·한국 시간 분이다', () => {
    assert.equal(fingerprint, '301-****-9047-01|230000|김예시|2026-11-24 09:04');
  });

  it('같은 문자를 문자와 점검으로 보내면 한 건만 남긴다', () => {
    const rows = [row({ id: 'sms-1', dedupeKey: 'sms-key', contentHash: HASH_A })];
    apply(rows, { dedupeKey: 'scan-key', contentHash: HASH_A, fingerprint });
    assert.equal(rows.length, 1);
  });

  it('해시 없는 옛 줄은 점검과 겹치면 한 건이고 해시를 채운다', () => {
    const rows = [row({ id: 'old-1', dedupeKey: 'old-key', contentHash: null })];
    apply(rows, { dedupeKey: 'scan-key', contentHash: HASH_A, fingerprint });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.contentHash, HASH_A);
  });

  it('같은 분·같은 이름·같은 금액이라도 해시가 다르면 두 건이다', () => {
    const rows = [row({ id: 'one', dedupeKey: 'k1', contentHash: HASH_A })];
    apply(rows, { dedupeKey: 'k2', contentHash: HASH_B, fingerprint });
    assert.equal(rows.length, 2);
  });

  it('해시는 64자 hex만 받는다', () => {
    assert.equal(normalizeContentHash(HASH_A.toUpperCase()), HASH_A);
    assert.equal(normalizeContentHash('short'), null);
  });
});

describe('해석 못 한 문자', () => {
  it('농협 입금인데 형식이 다르면 본문을 남긴다', () => {
    const kept = unparsedRecord('농협 입금 형식을 알 수 없는 안내');
    assert.equal(kept.keep, true);
    if (kept.keep) {
      assert.equal(kept.reason, 'unparsed');
      assert.match(kept.text ?? '', /농협/);
    }
  });

  it('잔액이 지워지지 않으면 본문을 저장하지 않는다', () => {
    const kept = unparsedRecord('농협 입금 잔액 남아있음');
    assert.equal(kept.keep, true);
    if (kept.keep) {
      assert.equal(kept.reason, 'balance_remains');
      assert.equal(kept.text, null);
    }
  });

  it('출금·결제는 남기지 않는다', () => {
    assert.equal(unparsedRecord('농협 출금 20,000원').keep, false);
    assert.equal(unparsedRecord('농협 결제 20,000원').keep, false);
  });

  it('다른 업체 줄은 그 업체 조건으로만 닫는다', () => {
    assert.deepEqual(resolveUnparsedWhere('tenant-b', 'row-1'), { id: 'row-1', tenantId: 'tenant-b' });
  });
});

describe('다시 훑기·기능', () => {
  it('점검 요청은 한 번만 실어 보낸다', () => {
    assert.deepEqual(rescanBody(true), { rescan: true, sinceHours: 48 });
    assert.deepEqual(rescanBody(false), {});
  });

  it('기능이 꺼지면 403 코드다', () => {
    assert.equal(bankDepositFeatureDisabledBody().code, 'feature_disabled');
  });

  it('하루보다 오래된 점검은 휴대폰 알림을 보내지 않는다', () => {
    const now = new Date('2026-11-24T12:00:00.000Z');
    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const fresh = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    assert.equal(teamMobilePushAllowed({ source: 'scan', depositedAt: old, now }), false);
    assert.equal(teamMobilePushAllowed({ source: 'scan', depositedAt: fresh, now }), true);
    assert.equal(teamMobilePushAllowed({ source: 'sms', depositedAt: old, now }), true);
  });
});
