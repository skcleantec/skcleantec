import { prisma } from '../../lib/prisma.js';
import { getSendResults, type BarobillKakaoSendResult } from '../../lib/barobill/kakaotalk.js';
import { notifyAlimtalkOpsOnceToday, safeOpsSentence } from './alimtalkBarobillOpsMail.js';
import { applyAlimtalkCharge } from './alimtalkWallet.service.js';

const BATCH = 100;
const UNCONFIRMED_MS = 30 * 60 * 1000;
const POLL_MS = 60_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollRunning = false;

/**
 * SmsSendState 관측값 (전화번호·인증키 제외).
 * 2026-11-16 기준 운영에서 받은 값이 아직 없다.
 * 처음 받은 값은 `[alimtalk-barobill-result] SmsSendState="..."` 한 줄로 남긴다.
 *
 * SendStatus: 0 보내는 중, 1 알림톡 성공, 2 알림톡 실패, 3 예약.
 * SendStatus 2 일 때 SmsSendState 잠정 판정:
 * - 대체문자 성공: 1, 성공, 전송성공, 완료, S, SUCCESS, Y
 * - 완전 실패: 2, 실패, 전송실패, F, FAIL, N, 빈 값
 * - 다음 회차: 0, 3, 대기, 전송중, 발송중, 예약
 * - 그 밖은 차감하지 않고 다음 회차에 다시 본다.
 */
const SMS_SUCCESS = new Set(['1', '성공', '전송성공', '완료', 's', 'success', 'y']);
const SMS_FAILED = new Set(['', '2', '실패', '전송실패', 'f', 'fail', 'n']);
const SMS_PENDING = new Set(['0', '3', '대기', '전송중', '발송중', '예약']);

const seenSmsStates = new Set<string>();

export type AlimtalkBarobillResultJob = {
  checked: number;
  ata: number;
  fallbackSms: number;
  fallbackLms: number;
  failed: number;
  pending: number;
  unconfirmed: number;
};

function rememberSmsState(raw: string): string {
  const safe = raw
    .replace(/01[016789]-?\d{3,4}-?\d{4}/g, '')
    .replace(/\d{4,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
  if (!seenSmsStates.has(safe)) {
    seenSmsStates.add(safe);
    console.info(`[alimtalk-barobill-result] SmsSendState=${JSON.stringify(safe)}`);
  }
  return safe;
}

function fallbackOutcome(state: string): 'success' | 'failed' | 'pending' | 'unknown' {
  const key = state.trim().toLowerCase();
  if (SMS_SUCCESS.has(key)) return 'success';
  if (SMS_PENDING.has(key)) return 'pending';
  if (SMS_FAILED.has(key)) return 'failed';
  return 'unknown';
}

function channelFromMarker(resultMessage: string | null): 'SMS' | 'LMS' {
  const match = /^sms-bytes:(\d+)$/.exec(resultMessage ?? '');
  if (!match) return 'LMS';
  return Number(match[1]) <= 90 ? 'SMS' : 'LMS';
}

function failureReason(result: BarobillKakaoSendResult): string {
  const text = safeOpsSentence(result.ResultMessage);
  return text || '발송에 실패했습니다.';
}

async function notifyUnconfirmed(): Promise<number> {
  const cutoff = new Date(Date.now() - UNCONFIRMED_MS);
  const rows = await prisma.alimtalkSendLog.findMany({
    where: { chargeStatus: 'AWAITING_RESULT', createdAt: { lt: cutoff } },
    select: { templateCode: true, smsSendState: true },
    take: BATCH,
  });
  if (rows.length === 0) return 0;
  const counts = new Map<string, number>();
  const states = new Set<string>();
  for (const row of rows) {
    counts.set(row.templateCode, (counts.get(row.templateCode) ?? 0) + 1);
    states.add(rememberSmsState(row.smsSendState ?? ''));
  }
  const lines = [...counts.entries()].map(([code, count]) => `${code} ${count}건`);
  const stateLine = [...states].map((state) => (state ? state : '(빈 값)')).join(', ');
  await notifyAlimtalkOpsOnceToday(
    'barobill-unconfirmed',
    '[청소비서] 알림톡 결과 미확정',
    `결과 확인이 30분을 넘긴 알림톡이 있습니다.\n${lines.join('\n')}\n대체문자 상태: ${stateLine}`,
  );
  return rows.length;
}

export function alimtalkBarobillResultPollEnabled(): boolean {
  const raw = (process.env.ALIMTALK_BAROBILL_RESULT_POLL ?? 'on').trim().toLowerCase();
  return raw !== 'off';
}

/** 서버 프로세스 안에서 60초마다. 이전 회차가 돌고 있으면 건너뛴다. */
export function startAlimtalkBarobillResultPoll(): void {
  if (!alimtalkBarobillResultPollEnabled()) {
    console.info('[alimtalk-barobill-result] poll off');
    return;
  }
  if (pollTimer) return;
  const tick = () => {
    if (pollRunning) return;
    pollRunning = true;
    void runAlimtalkBarobillResultJob()
      .then((summary) => {
        if (summary.checked > 0 || summary.unconfirmed > 0) {
          console.info('[alimtalk-barobill-result] poll', summary);
        }
      })
      .catch((err) => {
        console.error('[alimtalk-barobill-result] poll failed', err instanceof Error ? err.name : 'error');
      })
      .finally(() => {
        pollRunning = false;
      });
  };
  tick();
  pollTimer = setInterval(tick, POLL_MS);
  pollTimer.unref();
  console.info('[alimtalk-barobill-result] poll every 60s');
}

export function stopAlimtalkBarobillResultPoll(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

export async function runAlimtalkBarobillResultJob(): Promise<AlimtalkBarobillResultJob> {
  const summary: AlimtalkBarobillResultJob = {
    checked: 0,
    ata: 0,
    fallbackSms: 0,
    fallbackLms: 0,
    failed: 0,
    pending: 0,
    unconfirmed: 0,
  };
  const waiting = await prisma.alimtalkSendLog.count({
    where: { chargeStatus: 'AWAITING_RESULT' },
  });
  if (waiting === 0) return summary;
  const rows = await prisma.alimtalkSendLog.findMany({
    where: {
      chargeStatus: 'AWAITING_RESULT',
      provider: 'barobill',
      barobillSendKey: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: {
      id: true,
      tenantId: true,
      barobillSendKey: true,
      resultMessage: true,
    },
  });
  summary.checked = rows.length;
  if (rows.length === 0) {
    summary.unconfirmed = await notifyUnconfirmed();
    return summary;
  }

  const keys = rows.map((row) => row.barobillSendKey).filter((key): key is string => Boolean(key));
  const results = await getSendResults(keys);
  const byKey = new Map(results.filter((row) => row.SendKey).map((row) => [row.SendKey, row]));
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.tenantId))] } },
    select: { id: true, plan: true },
  });
  const plans = new Map(tenants.map((row) => [row.id, row.plan]));

  for (const row of rows) {
    const result = row.barobillSendKey ? byKey.get(row.barobillSendKey) : undefined;
    if (!result) {
      summary.pending += 1;
      continue;
    }
    const smsState = rememberSmsState(result.SmsSendState ?? '');
    const plan = plans.get(row.tenantId);
    if (!plan) {
      summary.pending += 1;
      continue;
    }
    if (result.SendStatus === 1) {
      const charged = await finalizeCharge(row, result, smsState, 'ATA', plan);
      if (charged) summary.ata += 1;
      else summary.pending += 1;
      continue;
    }
    if (result.SendStatus === 2) {
      const outcome = fallbackOutcome(smsState);
      if (outcome === 'pending' || outcome === 'unknown') {
        await markStillWaiting(row.id, result.SendStatus, smsState);
        summary.pending += 1;
        continue;
      }
      if (outcome === 'failed') {
        const closed = await markFailed(row.id, result, smsState);
        if (closed) summary.failed += 1;
        continue;
      }
      const channel = channelFromMarker(row.resultMessage);
      const charged = await finalizeCharge(row, result, smsState, channel, plan);
      if (!charged) summary.pending += 1;
      else if (channel === 'SMS') summary.fallbackSms += 1;
      else summary.fallbackLms += 1;
      continue;
    }
    await markStillWaiting(row.id, result.SendStatus, smsState);
    summary.pending += 1;
  }

  summary.unconfirmed = await notifyUnconfirmed();
  return summary;
}

async function markStillWaiting(id: string, sendStatus: number, smsState: string): Promise<void> {
  await prisma.alimtalkSendLog.updateMany({
    where: { id, chargeStatus: 'AWAITING_RESULT' },
    data: { sendStatus, smsSendState: smsState || null },
  });
}

async function markFailed(id: string, result: BarobillKakaoSendResult, smsState: string): Promise<boolean> {
  const reason = failureReason(result);
  const updated = await prisma.alimtalkSendLog.updateMany({
    where: { id, chargeStatus: 'AWAITING_RESULT' },
    data: {
      chargeStatus: 'FAILED',
      sendStatus: result.SendStatus,
      smsSendState: smsState || null,
      resultMessage: reason,
      errorMessage: reason,
      finalizedAt: new Date(),
    },
  });
  return updated.count === 1;
}

async function finalizeCharge(
  row: { id: string; tenantId: string; resultMessage: string | null },
  result: BarobillKakaoSendResult,
  smsState: string,
  channel: 'ATA' | 'SMS' | 'LMS',
  plan: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.alimtalkSendLog.updateMany({
      where: { id: row.id, chargeStatus: 'AWAITING_RESULT' },
      data: {
        chargeStatus: 'PENDING',
        sendStatus: result.SendStatus,
        smsSendState: smsState || null,
        resultMessage: null,
        finalizedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return false;
    const charge = await applyAlimtalkCharge({
      tenantId: row.tenantId,
      plan,
      channel,
      refId: row.id,
      db: tx,
    });
    await tx.alimtalkSendLog.update({
      where: { id: row.id },
      data: {
        chargeStatus: charge.chargeStatus,
        deliveredChannel: channel,
        freeUnitsConsumed: charge.freeUnitsConsumed,
        tenantUnitPriceKrw: charge.tenantUnitPriceKrw,
      },
    });
    return true;
  });
}
