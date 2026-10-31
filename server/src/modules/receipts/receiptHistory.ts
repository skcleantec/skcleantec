import { prisma } from '../../lib/prisma.js';

/**
 * 현금영수증·세금계산서 발급/취소/실패를 접수 히스토리(inquiry_change_logs)에 남긴다.
 * - 접수와 연결된 건은 그 접수 히스토리에, 연결 없는 건은 고객명만 붙여 업체 히스토리에 남는다.
 * - scheduleAlertKind는 비워 둔다(일정 사이렌 알림 대상 아님).
 * - 기록 실패가 발급 응답을 막지 않도록 오류는 삼킨다.
 */

type Failure = { message?: string; statusCode?: number; code?: string };

const won = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString('ko-KR')}원`;

/** 입력 검증 오류(400 등)는 남기지 않고, 지갑 부족·바로빌 오류·인증서 오류만 남긴다. */
export function receiptFailureWorthLogging(err: unknown): err is Failure {
  const e = err as Failure;
  if (!e || typeof e !== 'object') return false;
  const status = Number(e.statusCode ?? 500);
  if (e.message === '이미 처리 중') return false;
  if (status === 402 || status === 502 || status === 503 || status >= 500) return true;
  return status === 409 && e.code === 'cert';
}

async function write(params: {
  tenantId: string;
  inquiryId: string | null;
  customerName: string | null;
  actorId: string | null;
  line: string;
}): Promise<void> {
  try {
    let inquiryId: string | null = null;
    let name = params.customerName?.trim() || '';
    if (params.inquiryId) {
      const inquiry = await prisma.inquiry.findFirst({
        where: { id: params.inquiryId, tenantId: params.tenantId },
        select: { id: true, customerName: true },
      });
      if (inquiry) {
        inquiryId = inquiry.id;
        name = name || inquiry.customerName || '';
      }
    }
    // 연결 없는 건은 actor로 업체를 판별하므로 actor가 없으면 남기지 않는다.
    if (!inquiryId && !params.actorId) return;
    await prisma.inquiryChangeLog.create({
      data: {
        inquiryId,
        customerName: (name || '연계 없음').slice(0, 100),
        actorId: params.actorId,
        lines: [params.line],
        scheduleAlertKind: null,
      },
    });
  } catch (err) {
    console.warn('[receipt-history] write failed', err instanceof Error ? err.message : err);
  }
}

function cashbillUsage(row: { tradeUsage: number; identityMasked: string }): string {
  if (row.identityMasked === '자진발급') return '자진발급';
  return `${row.tradeUsage === 2 ? '지출증빙' : '소득공제'} ${row.identityMasked}`;
}

/** 현금영수증 발급·취소 결과 */
export async function logCashbillHistory(tenantId: string, actorId: string, issueId: string, action: 'issue' | 'cancel' | 'link'): Promise<void> {
  const row = await prisma.cashBillIssue.findFirst({
    where: { id: issueId, tenantId },
    include: { cancelOf: { select: { ntsConfirmNum: true } } },
  }).catch(() => null);
  if (!row) return;
  const failed = row.barobillState === '4000' || (!row.barobillState && Boolean(row.lastError));
  const head = action === 'cancel' ? '현금영수증 발급 취소' : action === 'link' ? '현금영수증 접수 연결' : '현금영수증 발급';
  const parts = [failed ? `${head} 실패` : head, won(row.totalWon), cashbillUsage(row)];
  const approval = action === 'cancel' ? row.cancelOf?.ntsConfirmNum : row.ntsConfirmNum;
  if (approval) parts.push(`승인 ${approval}`);
  if (failed && row.lastError) parts.push(row.lastError);
  await write({ tenantId, inquiryId: row.inquiryId, customerName: row.customerName, actorId, line: parts.join(' · ') });
}

/** 현금영수증 발급·취소가 오류로 끝났을 때(행이 없거나 응답 전 실패) */
export async function logCashbillFailure(params: {
  tenantId: string;
  actorId: string;
  action: 'issue' | 'cancel';
  err: unknown;
  issueId?: string;
  inquiryId?: unknown;
  customerName?: unknown;
  amount?: unknown;
}): Promise<void> {
  if (!receiptFailureWorthLogging(params.err)) return;
  let inquiryId = typeof params.inquiryId === 'string' ? params.inquiryId : null;
  let name = typeof params.customerName === 'string' ? params.customerName : null;
  let amount = Number(params.amount) || 0;
  if (params.issueId) {
    const row = await prisma.cashBillIssue.findFirst({ where: { id: params.issueId, tenantId: params.tenantId } }).catch(() => null);
    if (row) {
      inquiryId = row.inquiryId;
      name = row.customerName;
      amount = row.totalWon;
    }
  }
  const head = params.action === 'cancel' ? '현금영수증 발급 취소 실패' : '현금영수증 발급 실패';
  await write({
    tenantId: params.tenantId,
    inquiryId,
    customerName: name,
    actorId: params.actorId,
    line: [head, won(amount), params.err.message || '알 수 없는 오류'].join(' · '),
  });
}

/** 세금계산서 발급·취소·수정 결과 */
export async function logTaxInvoiceHistory(
  tenantId: string,
  actorId: string,
  issueId: string,
  action: 'issue' | 'cancel' | 'modify' | 'link',
  extra?: string,
): Promise<void> {
  const row = await prisma.taxInvoiceIssue.findFirst({ where: { id: issueId, tenantId } }).catch(() => null);
  if (!row) return;
  const head = action === 'cancel'
    ? '세금계산서 발급 취소'
    : action === 'modify'
      ? '수정세금계산서 발급'
      : action === 'link'
        ? '세금계산서 접수 연결'
        : '세금계산서 발급';
  const parts = [head];
  if (extra) parts.push(extra);
  parts.push(won(row.totalAmount), row.buyerCorpName);
  if (row.ntsSendKey) parts.push(`${action === 'modify' ? '원래 승인' : '승인'} ${row.ntsSendKey}`);
  await write({ tenantId, inquiryId: row.inquiryId, customerName: row.buyerCorpName, actorId, line: parts.join(' · ') });
}

export async function logTaxInvoiceFailure(params: {
  tenantId: string;
  actorId: string;
  action: 'issue' | 'cancel' | 'modify';
  err: unknown;
  issueId?: string;
  inquiryId?: unknown;
  buyerName?: unknown;
}): Promise<void> {
  if (!receiptFailureWorthLogging(params.err)) return;
  let inquiryId = typeof params.inquiryId === 'string' ? params.inquiryId : null;
  let name = typeof params.buyerName === 'string' ? params.buyerName : null;
  let amount: number | null = null;
  if (params.issueId) {
    const row = await prisma.taxInvoiceIssue.findFirst({ where: { id: params.issueId, tenantId: params.tenantId } }).catch(() => null);
    if (row) {
      inquiryId = row.inquiryId;
      name = row.buyerCorpName;
      amount = row.totalAmount;
    }
  }
  const head = params.action === 'cancel'
    ? '세금계산서 발급 취소 실패'
    : params.action === 'modify'
      ? '수정세금계산서 발급 실패'
      : '세금계산서 발급 실패';
  const parts = [head];
  if (amount != null) parts.push(won(amount));
  if (name) parts.push(name);
  parts.push(params.err.message || '알 수 없는 오류');
  await write({ tenantId: params.tenantId, inquiryId, customerName: name, actorId: params.actorId, line: parts.join(' · ') });
}

/** 목록에 「발급자」 이름을 붙이기 위한 id→이름 맵 */
export async function issuerNameMap(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } }).catch(() => []);
  return new Map(users.map((u) => [u.id, u.name?.trim() || '이름 없음']));
}
