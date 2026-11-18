import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { TaxInvoiceError, taxInvoiceCustomerUrl } from './taxInvoice.service.js';

const SHARE_TOKEN = /^t[A-Za-z0-9_-]{20,48}$/;

export function taxInvoiceShareTokenOk(token: string): boolean {
  return SHARE_TOKEN.test(token);
}

export function taxInvoiceShareLink(token: string): string {
  const origin = (process.env.PUBLIC_APP_URL || 'https://www.cbiseo.com').replace(/\/$/, '');
  return `${origin}/r/t/${token}`;
}

export async function ensureTaxInvoiceShareUrl(tenantId: string, issueId: string): Promise<string> {
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { id: issueId, tenantId },
    select: { id: true, publicToken: true },
  });
  if (!row) throw new TaxInvoiceError('영수증을 볼 수 있는 발급 건이 아닙니다.', 404);
  const ready = row.publicToken && taxInvoiceShareTokenOk(row.publicToken) ? row.publicToken : null;
  if (ready) return taxInvoiceShareLink(ready);
  const token = `t${randomBytes(18).toString('base64url')}`;
  const updated = await prisma.taxInvoiceIssue.updateMany({
    where: { id: row.id, tenantId, publicToken: row.publicToken },
    data: { publicToken: token },
  });
  if (updated.count > 0) return taxInvoiceShareLink(token);
  const again = await prisma.taxInvoiceIssue.findFirst({
    where: { id: row.id, tenantId },
    select: { publicToken: true },
  });
  if (!again?.publicToken || !taxInvoiceShareTokenOk(again.publicToken)) {
    throw new TaxInvoiceError('영수증 주소를 만들지 못했습니다.');
  }
  return taxInvoiceShareLink(again.publicToken);
}

export type TaxShareOpen = { kind: 'missing' } | { kind: 'cancelled' } | { kind: 'go'; url: string };

export async function openTaxInvoiceShare(token: string): Promise<TaxShareOpen> {
  if (!taxInvoiceShareTokenOk(token)) return { kind: 'missing' };
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { publicToken: token },
    select: {
      id: true,
      tenantId: true,
      barobillState: true,
      member: { select: { tenantId: true } },
    },
  });
  if (!row || row.member.tenantId !== row.tenantId) return { kind: 'missing' };
  if (row.barobillState === '5031') return { kind: 'cancelled' };
  try {
    const url = await taxInvoiceCustomerUrl(row.tenantId, row.id);
    if (!url.startsWith('https://')) return { kind: 'missing' };
    return { kind: 'go', url };
  } catch {
    return { kind: 'missing' };
  }
}
