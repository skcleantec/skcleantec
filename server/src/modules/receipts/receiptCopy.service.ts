import { randomBytes } from 'node:crypto';
import type { CashBillIssue, TaxInvoiceIssue } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { uploadObjectBuffer } from '../../lib/objectStorage.js';
import {
  displayBizIdentity,
  displayPhoneIdentity,
  formatBizFull,
  formatKstTime,
  formatYmd,
  won,
} from './receiptCopy.mask.js';
import { renderReceiptPdf, renderReceiptPng, type ReceiptCopyView } from './receiptCopy.render.js';
import { fetchCashbillMailUrl } from '../cashbill/cashbillIssue.barobill.js';
import { fetchTaxInvoiceMailUrl } from '../taxinvoice/taxInvoice.barobill.js';

const PENDING = '국세청 전송 중';

export type PublicReceipt = ReceiptCopyView & {
  updatedAt: string;
  hasImage: boolean;
  hasPdf: boolean;
  officialUrl: string | null;
};

function sealUrl(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const reg = (config as { companyRegistration?: { sealSecureUrl?: unknown } }).companyRegistration;
  const url = typeof reg?.sealSecureUrl === 'string' ? reg.sealSecureUrl.trim() : '';
  return url || null;
}

async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function newToken(prefix: 'c' | 't'): string {
  return `${prefix}${randomBytes(18).toString('base64url')}`;
}

async function storeCopy(tenantId: string, kind: 'cashbill' | 'taxinvoice', id: string, view: ReceiptCopyView) {
  const folder = `cbiseo/tenants/${tenantId}/receipts/${kind}`;
  const [png, pdf] = await Promise.all([
    renderReceiptPng(view).then((buffer) =>
      uploadObjectBuffer({
        folder,
        buffer,
        contentType: 'image/png',
        resourceType: 'image',
        stableFileName: `${id}.png`,
      }),
    ),
    renderReceiptPdf(view).then((buffer) =>
      uploadObjectBuffer({
        folder,
        buffer,
        contentType: 'application/pdf',
        resourceType: 'raw',
        fileNameHint: `${id}.pdf`,
        stableFileName: `${id}.pdf`,
      }),
    ),
  ]);
  return { pngUrl: png.secureUrl, pdfUrl: pdf.secureUrl };
}

type Merchant = { corpNum: string; corpName: string; ceoName: string; addr1: string; addr2: string | null; contactTel: string };

function merchantAddr(member: Merchant): string {
  return [member.addr1, member.addr2].map((part) => (part ?? '').trim()).filter(Boolean).join(' ');
}

function cashView(
  row: CashBillIssue & { member: Merchant; operatingCompany: { name: string } },
  logo: Buffer | null,
): ReceiptCopyView {
  const cancelled = row.kind === 'CANCEL' || row.barobillState === '7000';
  const failed = row.barobillState === '4000';
  const approval = row.ntsConfirmNum?.trim() || '';
  const confirmed = !cancelled && !failed && row.barobillState === '3000' && Boolean(approval);
  const badge = cancelled ? '취소' : failed ? '국세청 전송 실패' : confirmed ? null : PENDING;
  const identity = row.identityMasked.includes('자진')
    ? '자진발급'
    : row.tradeUsage === 2
      ? displayBizIdentity(row.identityMasked)
      : displayPhoneIdentity(row.identityMasked);
  const usage = row.identityMasked.includes('자진') ? '자진발급' : row.tradeUsage === 2 ? '지출증빙' : '소득공제';
  const addr = merchantAddr(row.member);
  return {
    title: '현금영수증',
    badge,
    logo,
    rows: [
      { label: '상호', value: row.operatingCompany.name || row.member.corpName },
      { label: '사업자번호', value: formatBizFull(row.member.corpNum) },
      { label: '대표자', value: row.member.ceoName || '—' },
      { label: '주소', value: addr || '—' },
      { label: '전화', value: row.member.contactTel || '—' },
      { label: '거래일시', value: `${formatYmd(row.tradeDate)} ${formatKstTime(row.createdAt)}` },
      { label: '거래구분', value: cancelled ? '취소' : '승인' },
      { label: '용도', value: usage },
      { label: '신분확인번호', value: identity },
    ],
    items: [{ name: row.itemName || '청소 서비스', supply: won(row.amount), tax: won(row.tax), total: won(row.totalWon) }],
    totals: [
      { label: '공급가액', value: won(row.amount) },
      { label: '부가세', value: won(row.tax) },
      { label: '합계', value: won(row.totalWon) },
    ],
    approval: approval || (cancelled || failed ? '—' : PENDING),
  };
}

type TaxLine = { name: string; supply: number; tax: number; total: number };

function taxLines(raw: unknown): TaxLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? '').trim();
    if (!name) return [];
    return [{ name, supply: Number(row.supply) || 0, tax: Number(row.tax) || 0, total: Number(row.total) || 0 }];
  });
}

function taxKindFromStored(lines: unknown): 'taxable' | 'zero' | 'exempt' {
  if (!Array.isArray(lines)) return 'taxable';
  for (const item of lines) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { kind?: unknown; taxKind?: unknown };
    if (row.kind !== 'settlement') continue;
    if (row.taxKind === 'zero' || row.taxKind === 'exempt' || row.taxKind === 'taxable') return row.taxKind;
  }
  return 'taxable';
}

function taxView(
  row: TaxInvoiceIssue & { member: Merchant; operatingCompany: { name: string } },
  logo: Buffer | null,
): ReceiptCopyView {
  const cancelled = row.barobillState === '5031';
  const failed = row.ntsSendState === '5';
  const approval = row.ntsSendKey?.trim() || '';
  const confirmed = !cancelled && !failed && row.ntsSendState === '4' && Boolean(approval);
  const badge = cancelled ? '취소' : failed ? '국세청 전송 실패' : confirmed ? null : PENDING;
  const addr = merchantAddr(row.member);
  const lines = taxLines(row.lines);
  return {
    title: taxKindFromStored(row.lines) === 'exempt' ? '계산서' : '세금계산서',
    badge,
    logo,
    rows: [
      { label: '공급자 상호', value: row.operatingCompany.name || row.member.corpName },
      { label: '공급자 사업자번호', value: formatBizFull(row.member.corpNum) },
      { label: '공급자 대표자', value: row.member.ceoName || '—' },
      { label: '공급자 주소', value: addr || '—' },
      { label: '공급자 전화', value: row.member.contactTel || '—' },
      { label: '공급받는자 상호', value: row.buyerCorpName },
      { label: '공급받는자 사업자번호', value: displayBizIdentity(row.buyerCorpNum) },
      { label: '공급받는자 대표자', value: row.buyerCeoName || '—' },
      { label: '공급받는자 주소', value: row.buyerAddr || '—' },
      { label: '공급받는자 이메일', value: row.buyerEmail || '—' },
      { label: '작성일자', value: formatYmd(row.writeDate) },
      { label: '영수/청구', value: row.purposeType === 2 ? '청구' : '영수' },
    ],
    items: (lines.length ? lines : [{ name: '청소 서비스', supply: row.supplyAmount, tax: row.taxAmount, total: row.totalAmount }]).map((line) => ({
      name: line.name,
      supply: won(line.supply),
      tax: taxKindFromStored(row.lines) === 'exempt' ? '' : won(line.tax),
      total: won(line.total),
    })),
    totals: [
      { label: '공급가액', value: won(row.supplyAmount) },
      ...(taxKindFromStored(row.lines) === 'exempt' ? [] : [{ label: '세액', value: won(row.taxAmount) }]),
      { label: '합계', value: won(row.totalAmount) },
    ],
    approval: approval || (cancelled || failed ? '—' : PENDING),
  };
}

const memberSelect = {
  corpNum: true,
  corpName: true,
  ceoName: true,
  addr1: true,
  addr2: true,
  contactTel: true,
  tenantId: true,
  barobillUserId: true,
} as const;

export async function renderCashbillCopy(issueId: string): Promise<void> {
  const row = await prisma.cashBillIssue.findFirst({
    where: { id: issueId },
    include: { member: { select: memberSelect }, operatingCompany: { select: { name: true, config: true, tenantId: true } } },
  });
  if (!row || row.member.tenantId !== row.tenantId || row.operatingCompany.tenantId !== row.tenantId) return;
  const token = row.publicToken ?? newToken('c');
  const logo = await fetchLogo(sealUrl(row.operatingCompany.config));
  const stored = await storeCopy(row.tenantId, 'cashbill', row.id, cashView(row, logo));
  await prisma.cashBillIssue.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: { publicToken: token, copyPngUrl: stored.pngUrl, copyPdfUrl: stored.pdfUrl },
  });
}

export async function renderTaxInvoiceCopy(issueId: string): Promise<void> {
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { id: issueId },
    include: { member: { select: memberSelect }, operatingCompany: { select: { name: true, config: true, tenantId: true } } },
  });
  if (!row || row.member.tenantId !== row.tenantId || row.operatingCompany.tenantId !== row.tenantId) return;
  const token = row.publicToken ?? newToken('t');
  const logo = await fetchLogo(sealUrl(row.operatingCompany.config));
  const stored = await storeCopy(row.tenantId, 'taxinvoice', row.id, taxView(row, logo));
  await prisma.taxInvoiceIssue.updateMany({
    where: { id: row.id, tenantId: row.tenantId },
    data: { publicToken: token, copyPngUrl: stored.pngUrl, copyPdfUrl: stored.pdfUrl },
  });
}

export async function safeRenderCashbillCopy(issueId: string): Promise<void> {
  try {
    await renderCashbillCopy(issueId);
  } catch (err) {
    console.error('[receipt-copy] cashbill', err instanceof Error ? err.name : 'fail');
  }
}

export async function safeRenderTaxInvoiceCopy(issueId: string): Promise<void> {
  try {
    await renderTaxInvoiceCopy(issueId);
  } catch (err) {
    console.error('[receipt-copy] taxinvoice', err instanceof Error ? err.name : 'fail');
  }
}

function publicOf(
  view: ReceiptCopyView,
  updatedAt: Date,
  png: string | null,
  pdf: string | null,
  officialUrl: string | null,
): PublicReceipt {
  const official = Boolean(officialUrl);
  return {
    ...view,
    logo: null,
    updatedAt: updatedAt.toISOString(),
    hasImage: official ? false : Boolean(png),
    hasPdf: official ? false : Boolean(pdf),
    officialUrl,
  };
}

async function cashbillOfficialMail(row: {
  barobillState: string | null;
  mgtKey: string;
  member: { corpNum: string; barobillUserId: string };
}): Promise<string | null> {
  if (!row.barobillState || row.barobillState === '1000') return null;
  try {
    return await fetchCashbillMailUrl({
      corpNum: row.member.corpNum,
      userId: row.member.barobillUserId,
      mgtKey: row.mgtKey,
    });
  } catch {
    return null;
  }
}

async function taxOfficialMail(row: { barobillState: string | null; mgtKey: string; member: { corpNum: string } }): Promise<string | null> {
  if (!row.barobillState || row.barobillState === '1000') return null;
  try {
    return await fetchTaxInvoiceMailUrl({ corpNum: row.member.corpNum, mgtKey: row.mgtKey });
  } catch {
    return null;
  }
}

/** 토큰 1건만 조회한다. 같은 업체의 다른 영수증은 읽지 않는다. */
export async function findPublicReceipt(token: string): Promise<{ doc: PublicReceipt; pngUrl: string | null; pdfUrl: string | null } | null> {
  if (!/^[ct][A-Za-z0-9_-]{20,48}$/.test(token)) return null;
  if (token.startsWith('c')) {
    const row = await prisma.cashBillIssue.findFirst({
      where: { publicToken: token },
      include: { member: { select: memberSelect }, operatingCompany: { select: { name: true, config: true, tenantId: true } } },
    });
    if (!row || row.member.tenantId !== row.tenantId) return null;
    const officialUrl = await cashbillOfficialMail(row);
    return { doc: publicOf(cashView(row, null), row.updatedAt, row.copyPngUrl, row.copyPdfUrl, officialUrl), pngUrl: officialUrl ? null : row.copyPngUrl, pdfUrl: officialUrl ? null : row.copyPdfUrl };
  }
  const row = await prisma.taxInvoiceIssue.findFirst({
    where: { publicToken: token },
    include: { member: { select: memberSelect }, operatingCompany: { select: { name: true, config: true, tenantId: true } } },
  });
  if (!row || row.member.tenantId !== row.tenantId) return null;
  const officialUrl = await taxOfficialMail(row);
  return { doc: publicOf(taxView(row, null), row.updatedAt, row.copyPngUrl, row.copyPdfUrl, officialUrl), pngUrl: officialUrl ? null : row.copyPngUrl, pdfUrl: officialUrl ? null : row.copyPdfUrl };
}
