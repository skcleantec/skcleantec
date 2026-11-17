import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { CashbillIssueError, cashbillCustomerUrl } from './cashbillIssue.service.js';

const SHARE_TOKEN = /^c[A-Za-z0-9_-]{20,48}$/;
const CANCEL_DONE = new Set(['2000', '2500', '3000', '7000']);

export function cashbillShareTokenOk(token: string): boolean {
  return SHARE_TOKEN.test(token);
}

export function cashbillShareLink(token: string): string {
  const origin = (process.env.PUBLIC_APP_URL || 'https://www.cbiseo.com').replace(/\/$/, '');
  return `${origin}/r/c/${token}`;
}

export function cashbillShareCancelled(
  kind: string,
  cancellations: { barobillState: string | null }[],
): boolean {
  if (kind === 'CANCEL') return true;
  return cancellations.some((child) => Boolean(child.barobillState && CANCEL_DONE.has(child.barobillState)));
}

/** 발행 건 하나에만 쓰는 주소. 없으면 그때 만든다. */
export async function ensureCashbillShareUrl(tenantId: string, issueId: string): Promise<string> {
  const row = await prisma.cashBillIssue.findFirst({
    where: { id: issueId, tenantId },
    select: { id: true, publicToken: true },
  });
  if (!row) throw new CashbillIssueError('영수증을 볼 수 있는 발급 건이 아닙니다.', 404);
  const ready = row.publicToken && cashbillShareTokenOk(row.publicToken) ? row.publicToken : null;
  if (ready) return cashbillShareLink(ready);
  const token = `c${randomBytes(18).toString('base64url')}`;
  const updated = await prisma.cashBillIssue.updateMany({
    where: { id: row.id, tenantId, publicToken: row.publicToken },
    data: { publicToken: token },
  });
  if (updated.count > 0) return cashbillShareLink(token);
  const again = await prisma.cashBillIssue.findFirst({
    where: { id: row.id, tenantId },
    select: { publicToken: true },
  });
  if (!again?.publicToken || !cashbillShareTokenOk(again.publicToken)) {
    throw new CashbillIssueError('영수증 주소를 만들지 못했습니다.');
  }
  return cashbillShareLink(again.publicToken);
}

export type CashbillShareOpen =
  | { kind: 'missing' }
  | { kind: 'cancelled' }
  | { kind: 'go'; url: string };

/** 토큰 하나로 그 발행 건만 연다. 주소는 응답 문구에 넣지 않는다. */
export async function openCashbillShare(token: string): Promise<CashbillShareOpen> {
  if (!cashbillShareTokenOk(token)) return { kind: 'missing' };
  const row = await prisma.cashBillIssue.findFirst({
    where: { publicToken: token },
    select: {
      id: true,
      tenantId: true,
      kind: true,
      cancellations: { select: { barobillState: true } },
      member: { select: { tenantId: true } },
    },
  });
  if (!row || row.member.tenantId !== row.tenantId) return { kind: 'missing' };
  if (cashbillShareCancelled(row.kind, row.cancellations)) return { kind: 'cancelled' };
  try {
    const url = await cashbillCustomerUrl(row.tenantId, row.id);
    if (!url.startsWith('https://')) return { kind: 'missing' };
    return { kind: 'go', url };
  } catch {
    return { kind: 'missing' };
  }
}
