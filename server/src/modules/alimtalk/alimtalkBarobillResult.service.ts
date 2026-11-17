import { maskPhone } from '../../lib/barobill/mask.js';
import { getMemberBalance, getSendResults, type BarobillKakaoSendResult } from '../../lib/barobill/kakaotalk.js';
import { prisma } from '../../lib/prisma.js';
import { sendAlimtalkOpsMail } from './alimtalkBarobillOpsMail.js';
import { BAROBILL_TEMPLATE_NAME_BY_CODE } from './alimtalkBarobillSync.service.js';
import {
  buildUnconfirmedMail,
  describeUnconfirmedStatus,
  fallbackOutcome,
  publicCustomerName,
  publicInquiryNumber,
  publicTemplateTitle,
  sanitizeBarobillReason,
  type UnconfirmedMailItem,
} from './alimtalkBarobillUnconfirmedCopy.js';
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
 * - 완전 실패(차감 없음): 2, 실패, 전송실패, F, FAIL, N, 빈 값, '-'
 * - 다음 회차: 0, 3, 대기, 전송중, 발송중, 예약
 * - 그 밖은 차감하지 않고 다음 회차에 다시 본다.
 * SendStatus 1 은 대체문자 값과 관계없이 알림톡 성공으로 차감한다.
 */

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

function channelFromMarker(resultMessage: string | null): 'SMS' | 'LMS' {
  const match = /^sms-bytes:(\d+)$/.exec(resultMessage ?? '');
  if (!match) return 'LMS';
  return Number(match[1]) <= 90 ? 'SMS' : 'LMS';
}

function failureReason(result: BarobillKakaoSendResult): string {
  return sanitizeBarobillReason(result.ResultMessage) || '발송에 실패했습니다.';
}

type WaitingRow = {
  id: string;
  tenantId: string;
  templateCode: string;
  inquiryId: string | null;
  orderFormId: string | null;
  toPhone: string;
  createdAt: Date;
  sendStatus: number | null;
  smsSendState: string | null;
  barobillSendKey: string | null;
};

async function notifyUnconfirmed(known: Map<string, BarobillKakaoSendResult>): Promise<number> {
  const cutoff = new Date(Date.now() - UNCONFIRMED_MS);
  const candidates = await prisma.alimtalkSendLog.findMany({
    where: {
      chargeStatus: 'AWAITING_RESULT',
      createdAt: { lt: cutoff },
      unconfirmedMailAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      tenantId: true,
      templateCode: true,
      inquiryId: true,
      orderFormId: true,
      toPhone: true,
      createdAt: true,
      sendStatus: true,
      smsSendState: true,
      barobillSendKey: true,
    },
  });
  if (candidates.length === 0) return 0;

  const stamp = new Date();
  const ownedIds = await claimUnconfirmed(candidates, stamp);
  const owned = candidates.filter((row) => ownedIds.has(row.id));
  if (owned.length === 0) return 0;

  try {
    const mail = await composeUnconfirmedMail(owned, known);
    const sent = await sendAlimtalkOpsMail(mail.subject, mail.text);
    if (!sent) {
      await clearUnconfirmedStamp(owned);
      return 0;
    }
    console.info(`[alimtalk-barobill-result] unconfirmed mail items=${owned.length}`);
    return owned.length;
  } catch (err) {
    await clearUnconfirmedStamp(owned);
    console.error('[alimtalk-barobill-result] unconfirmed mail', err instanceof Error ? err.name : 'error');
    return 0;
  }
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
    summary.unconfirmed = await notifyUnconfirmed(new Map());
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
    if (result.SendStatus === 2 && fallbackOutcome(smsState) === 'failed') {
      const closed = await markFailed(row, result, smsState);
      if (closed) summary.failed += 1;
      continue;
    }
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
        await markStillWaiting(row, result.SendStatus, smsState);
        summary.pending += 1;
        continue;
      }
      const channel = channelFromMarker(row.resultMessage);
      const charged = await finalizeCharge(row, result, smsState, channel, plan);
      if (!charged) summary.pending += 1;
      else if (channel === 'SMS') summary.fallbackSms += 1;
      else summary.fallbackLms += 1;
      continue;
    }
    await markStillWaiting(row, result.SendStatus, smsState);
    summary.pending += 1;
  }

  summary.unconfirmed = await notifyUnconfirmed(byKey);
  return summary;
}

async function markStillWaiting(
  row: { id: string; tenantId: string },
  sendStatus: number,
  smsState: string,
): Promise<void> {
  await prisma.alimtalkSendLog.updateMany({
    where: { id: row.id, tenantId: row.tenantId, chargeStatus: 'AWAITING_RESULT' },
    data: { sendStatus, smsSendState: smsState || null },
  });
}

async function markFailed(
  row: { id: string; tenantId: string },
  result: BarobillKakaoSendResult,
  smsState: string,
): Promise<boolean> {
  const reason = failureReason(result);
  const updated = await prisma.alimtalkSendLog.updateMany({
    where: { id: row.id, tenantId: row.tenantId, chargeStatus: 'AWAITING_RESULT' },
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
      where: { id: row.id, tenantId: row.tenantId, chargeStatus: 'AWAITING_RESULT' },
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
    await tx.alimtalkSendLog.updateMany({
      where: { id: row.id, tenantId: row.tenantId },
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

async function claimUnconfirmed(rows: WaitingRow[], stamp: Date): Promise<Set<string>> {
  const owned = new Set<string>();
  const byTenant = new Map<string, WaitingRow[]>();
  for (const row of rows) {
    const list = byTenant.get(row.tenantId) ?? [];
    list.push(row);
    byTenant.set(row.tenantId, list);
  }
  for (const [tenantId, list] of byTenant) {
    const ids = list.map((row) => row.id);
    const updated = await prisma.alimtalkSendLog.updateMany({
      where: {
        tenantId,
        id: { in: ids },
        chargeStatus: 'AWAITING_RESULT',
        unconfirmedMailAt: null,
      },
      data: { unconfirmedMailAt: stamp },
    });
    if (updated.count === 0) continue;
    if (updated.count === ids.length) {
      for (const id of ids) owned.add(id);
      continue;
    }
    const stamped = await prisma.alimtalkSendLog.findMany({
      where: { tenantId, id: { in: ids }, unconfirmedMailAt: stamp },
      select: { id: true },
    });
    for (const row of stamped) owned.add(row.id);
  }
  return owned;
}

async function clearUnconfirmedStamp(rows: { id: string; tenantId: string }[]): Promise<void> {
  const byTenant = new Map<string, string[]>();
  for (const row of rows) {
    const list = byTenant.get(row.tenantId) ?? [];
    list.push(row.id);
    byTenant.set(row.tenantId, list);
  }
  for (const [tenantId, ids] of byTenant) {
    await prisma.alimtalkSendLog.updateMany({
      where: { tenantId, id: { in: ids } },
      data: { unconfirmedMailAt: null },
    });
  }
}

async function composeUnconfirmedMail(
  rows: WaitingRow[],
  known: Map<string, BarobillKakaoSendResult>,
): Promise<{ subject: string; text: string }> {
  const shown = rows.slice(0, 20);
  const missingKeys = shown
    .map((row) => row.barobillSendKey)
    .filter((key): key is string => key != null && !known.has(key));
  const fetched = new Map<string, BarobillKakaoSendResult>();
  if (missingKeys.length > 0) {
    try {
      const results = await getSendResults(missingKeys);
      for (const result of results) {
        if (result.SendKey) fetched.set(result.SendKey, result);
      }
    } catch (err) {
      console.error('[alimtalk-barobill-result] unconfirmed lookup', err instanceof Error ? err.name : 'error');
    }
  }

  const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
  const inquiryIds = [...new Set(shown.map((row) => row.inquiryId).filter((id): id is string => Boolean(id)))];
  const orderFormIds = [...new Set(shown.map((row) => row.orderFormId).filter((id): id is string => Boolean(id)))];
  const codes = [...new Set(shown.map((row) => row.templateCode))];
  const [tenants, inquiries, orderForms, templates, memberBalanceKrw] = await Promise.all([
    prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }),
    inquiryIds.length
      ? prisma.inquiry.findMany({
          where: { id: { in: inquiryIds }, tenantId: { in: tenantIds } },
          select: { id: true, tenantId: true, customerName: true, inquiryNumber: true },
        })
      : Promise.resolve([]),
    orderFormIds.length
      ? prisma.orderForm.findMany({
          where: { id: { in: orderFormIds }, tenantId: { in: tenantIds } },
          select: { id: true, tenantId: true, customerName: true },
        })
      : Promise.resolve([]),
    prisma.alimtalkTemplate.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true, barobillTemplateName: true },
    }),
    readMemberBalance(),
  ]);

  const tenantName = new Map(tenants.map((row) => [row.id, row.name]));
  const inquiryById = new Map(inquiries.map((row) => [`${row.tenantId}:${row.id}`, row]));
  const orderById = new Map(orderForms.map((row) => [`${row.tenantId}:${row.id}`, row]));
  const templateByCode = new Map(templates.map((row) => [row.code, row]));
  const items: UnconfirmedMailItem[] = shown.map((row) => {
    const live = row.barobillSendKey ? known.get(row.barobillSendKey) ?? fetched.get(row.barobillSendKey) : undefined;
    const status = describeUnconfirmedStatus({
      found: Boolean(live),
      sendStatus: live?.SendStatus ?? null,
      smsSendState: live ? rememberSmsState(live.SmsSendState ?? '') : null,
    });
    const inquiry = row.inquiryId ? inquiryById.get(`${row.tenantId}:${row.inquiryId}`) : undefined;
    const order = row.orderFormId ? orderById.get(`${row.tenantId}:${row.orderFormId}`) : undefined;
    const template = templateByCode.get(row.templateCode);
    const reason = sanitizeBarobillReason(live?.ResultMessage) || status.defaultReason;
    return {
      tenantName: tenantName.get(row.tenantId)?.trim() || '업체',
      templateName: publicTemplateTitle(
        row.templateCode,
        template?.barobillTemplateName || template?.name,
        BAROBILL_TEMPLATE_NAME_BY_CODE as Record<string, string>,
      ),
      customerName: publicCustomerName(inquiry?.customerName || order?.customerName),
      maskedPhone: maskPhone(row.toPhone),
      inquiryNumber: publicInquiryNumber(inquiry?.inquiryNumber),
      sentAt: row.createdAt,
      statusLine: status.line,
      reason,
    };
  });
  const tenantNames = rows.map((row) => tenantName.get(row.tenantId)?.trim() || '업체');
  return buildUnconfirmedMail({
    total: rows.length,
    tenantNames,
    items,
    overflow: Math.max(0, rows.length - 20),
    memberBalanceKrw,
  });
}

async function readMemberBalance(): Promise<number | null> {
  try {
    const balance = await getMemberBalance();
    return Number.isFinite(balance) ? balance : null;
  } catch (err) {
    console.error('[alimtalk-barobill-result] member balance', err instanceof Error ? err.name : 'error');
    return null;
  }
}
