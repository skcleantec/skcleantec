import { Router } from 'express';
import { platformAuthMiddleware, type PlatformScopedRequest } from '../platform/platformAuth.middleware.js';
import { maskIssuer, readPlatformIssuer, refreshPlatformIssuerCert, platformIssuerCertRegisterUrl } from './platformIssuer.js';
import * as XLSX from 'xlsx';
import {
  issuePlatformCashBill,
  cancelPlatformCashBill,
  listPlatformCashBills,
  listPlatformCashBillsForExport,
  platformCashBillStats,
} from './platformCashbill.service.js';
import {
  issuePlatformTaxInvoice,
  cancelPlatformTaxInvoice,
  listPlatformTaxInvoices,
  listPlatformTaxInvoicesForExport,
  platformTaxInvoiceStats,
} from './platformTaxInvoice.service.js';
import { retryFailedWalletInvoice } from './platformWalletInvoice.service.js';
import { prisma } from '../../lib/prisma.js';
import { splitCashbillTax } from '../cashbill/cashbillIssue.amounts.js';
import { formatCorpNumDisplay, parsePlatformReceiptListQuery } from './platformReceiptsQuery.js';

const router = Router();
router.use(platformAuthMiddleware);

function ymd8(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 8);
}

function dashYmd(ymd: string): string {
  if (ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function cashbillUsageLabel(usage: string): string {
  if (usage === 'biz') return '지출증빙';
  if (usage === 'voluntary') return '자진발급';
  return '소득공제';
}

function cashbillPublic(row: {
  id: string;
  tradeUsage: string;
  identityMasked: string;
  customerName: string | null;
  itemName: string;
  taxKind: string;
  amount: number;
  tax: number;
  totalWon: number;
  tradeDate: string;
  issuedAt: Date | null;
  lastError: string | null;
  internalMemo: string | null;
  buyerCorpNum: string | null;
  cancelOfId: string | null;
  kind: string;
  costKrw: number;
  buyerTenantId: string | null;
  ntsConfirmNum?: string | null;
}) {
  const cancelled = row.kind === 'CANCELLED' || row.kind === 'CANCEL' || Boolean(row.cancelOfId);
  const usage = row.identityMasked === '자진발급' ? 'voluntary' : row.tradeUsage === '2' ? 'biz' : 'phone';
  const taxKind = row.taxKind.includes('면') ? 'exempt' : 'taxable';
  return {
    id: row.id,
    status: row.lastError ? 'FAILED' : cancelled ? 'CANCELLED' : 'ISSUED',
    taxKind,
    usage,
    usageLabel: cashbillUsageLabel(usage),
    identity: row.identityMasked,
    itemName: row.itemName,
    amountKrw: row.totalWon,
    supplyAmountKrw: row.amount,
    vatAmountKrw: row.tax,
    tradeDate: dashYmd(row.tradeDate),
    issuedAt: row.issuedAt?.toISOString() ?? new Date().toISOString(),
    cancelledAt: cancelled ? row.issuedAt?.toISOString() ?? null : null,
    buyerName: row.customerName,
    buyerCorpNum: row.buyerCorpNum,
    email: null,
    memo: row.internalMemo,
    error: row.lastError,
    tenantName: null as string | null,
    costKrw: row.costKrw,
    buyerTenantId: row.buyerTenantId,
    ntsConfirmNum: row.ntsConfirmNum ?? null,
  };
}

function taxInvoicePublic(row: {
  id: string;
  purposeType?: number;
  writeDate: string;
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCeoName: string;
  buyerAddr: string;
  buyerEmail: string;
  supplyKrw: number;
  taxKrw: number;
  totalKrw: number;
  lines: unknown;
  lastError: string | null;
  internalMemo: string | null;
  modifyCode: string | null;
  barobillState: string | null;
  ntsSendKey?: string | null;
  costKrw: number;
  createdAt: Date;
  buyerTenantId: string | null;
}) {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  const first = lines[0] as { name?: string } | undefined;
  const cancelled = row.barobillState === 'ISSUE_CANCEL' || row.barobillState === '5031';
  return {
    id: row.id,
    status: row.lastError ? 'FAILED' : cancelled ? 'CANCELLED' : 'ISSUED',
    purposeType: row.purposeType ?? 1,
    usageLabel: (row.purposeType ?? 1) === 2 ? '청구' : '영수',
    writeDate: dashYmd(row.writeDate),
    issuedAt: row.createdAt.toISOString(),
    cancelledAt: cancelled ? row.createdAt.toISOString() : null,
    buyerCorpNum: row.buyerCorpNum,
    buyerCorpName: row.buyerCorpName,
    buyerCeoName: row.buyerCeoName || null,
    buyerAddr: row.buyerAddr || null,
    buyerEmail: row.buyerEmail || null,
    supplyAmountKrw: row.supplyKrw,
    vatAmountKrw: row.taxKrw,
    totalAmountKrw: row.totalKrw,
    itemName: first?.name ?? '세금계산서',
    memo: row.internalMemo,
    error: row.lastError,
    tenantName: null as string | null,
    costKrw: row.costKrw,
    buyerTenantId: row.buyerTenantId,
    ntsConfirmNum: row.ntsSendKey ?? null,
  };
}

async function tenantNameMap(ids: (string | null | undefined)[]) {
  const tenantIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (tenantIds.length === 0) return new Map<string, string>();
  const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
  return new Map(tenants.map((t) => [t.id, t.name]));
}

function sendXlsx(res: import('express').Response, filename: string, rows: Record<string, string | number>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '영수증');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(buffer);
}

router.get('/issuer', (_req, res) => {
  try {
    const issuer = readPlatformIssuer();
    const masked = maskIssuer(issuer);
    res.json({
      ...masked,
      corpNum: issuer.corpNum.replace(/\D/g, ''),
      corpNumDisplay: formatCorpNumDisplay(issuer.corpNum),
      corpNumMasked: formatCorpNumDisplay(issuer.corpNum),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '발행자 정보 없음' });
  }
});

router.get('/issuer/cert', async (_req, res) => {
  try {
    res.json(await refreshPlatformIssuerCert());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '인증서 확인 실패' });
  }
});

router.post('/issuer/cert-url', async (_req, res) => {
  try {
    res.json({ url: await platformIssuerCertRegisterUrl() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '인증서 등록 URL 조회 실패' });
  }
});

router.get('/cashbills', async (req, res) => {
  const parsed = parsePlatformReceiptListQuery(req.query as Record<string, unknown>);
  const buyerTenantId = typeof req.query.buyerTenantId === 'string' ? req.query.buyerTenantId.trim() : undefined;
  const result = await listPlatformCashBills({
    limit: parsed.limit,
    offset: parsed.offset,
    buyerTenantId,
    fromYmd: parsed.fromYmd,
    toYmd: parsed.toYmd,
    status: parsed.status,
    q: parsed.q,
  });
  const names = await tenantNameMap(result.items.map((r) => r.buyerTenantId));
  res.json({
    total: result.total,
    items: result.items.map((row) => ({
      ...cashbillPublic(row),
      tenantName: row.buyerTenantId ? names.get(row.buyerTenantId) ?? null : null,
    })),
  });
});

router.get('/cashbills/export', async (req, res) => {
  try {
    const parsed = parsePlatformReceiptListQuery(req.query as Record<string, unknown>);
    const rows = await listPlatformCashBillsForExport({
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      status: parsed.status,
      q: parsed.q,
    });
    const names = await tenantNameMap(rows.map((r) => r.buyerTenantId));
    const excelRows = rows.map((row) => {
      const pub = cashbillPublic(row);
      return {
        거래일: pub.tradeDate,
        '업체/고객': names.get(row.buyerTenantId ?? '') || row.customerName || '',
        용도: pub.usageLabel,
        공급가: pub.supplyAmountKrw,
        부가세: pub.vatAmountKrw,
        합계: pub.amountKrw,
        상태: pub.status === 'ISSUED' ? '발행' : pub.status === 'CANCELLED' ? '취소' : '실패',
        '국세청 승인번호': row.ntsConfirmNum ?? '',
      };
    });
    sendXlsx(res, `플랫폼_현금영수증_${parsed.fromYmd || 'all'}_${parsed.toYmd || 'all'}.xlsx`, excelRows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '엑셀 내보내기 실패' });
  }
});

router.post('/cashbills', async (req, res) => {
  const user = (req as PlatformScopedRequest).platformUser;
  try {
    const body = req.body as Record<string, unknown>;
    const usageRaw = String(body.usage ?? body.tradeUsage ?? 'phone');
    const usage = usageRaw === 'biz' || usageRaw === '2' ? 'biz' : usageRaw === 'voluntary' ? 'voluntary' : 'phone';
    const taxKindRaw = String(body.taxKind ?? 'taxable').toLowerCase();
    const taxKind = taxKindRaw.includes('exempt') || taxKindRaw.includes('면') ? 'exempt' : 'taxable';
    const totalWon = Math.trunc(Number(body.amountKrw ?? body.amount ?? 0));
    if (!Number.isFinite(totalWon) || totalWon < 1) {
      res.status(400).json({ error: '금액을 확인해 주세요.' });
      return;
    }
    const split = splitCashbillTax(totalWon, taxKind);
    const tradeDate = ymd8(String(body.tradeDate ?? ''));
    if (tradeDate.length !== 8) {
      res.status(400).json({ error: '거래일자를 확인해 주세요.' });
      return;
    }
    const itemName = String(body.itemName ?? '').trim() || '청소비서 이용료';
    let identityNum = String(body.identity ?? body.identityNum ?? '').replace(/\D/g, '');
    let tradeMethod: '4' | '5' = '4';
    let tradeUsage: '1' | '2' = '1';
    let identityMaskedHint: string | undefined;
    if (usage === 'voluntary') {
      identityNum = '0100001234';
      tradeMethod = '5';
      tradeUsage = '1';
      identityMaskedHint = '자진발급';
    } else if (usage === 'biz') {
      if (identityNum.length !== 10) {
        res.status(400).json({ error: '사업자등록번호 10자리를 입력해 주세요.' });
        return;
      }
      tradeUsage = '2';
      tradeMethod = '4';
    } else {
      if (!/^01\d{8,9}$/.test(identityNum)) {
        res.status(400).json({ error: '소득공제는 휴대폰 번호만 입력할 수 있습니다.' });
        return;
      }
      tradeUsage = '1';
      tradeMethod = '5';
    }

    const record = await issuePlatformCashBill({
      tradeUsage,
      tradeMethod,
      identityNum,
      identityMaskedOverride: identityMaskedHint,
      customerName: typeof body.buyerName === 'string' ? body.buyerName.trim() : undefined,
      itemName,
      taxKind: taxKind === 'exempt' ? 'EXEMPTION' : 'TAXATION',
      amount: split.amount,
      tax: split.tax,
      serviceCharge: split.serviceCharge,
      tradeDate,
      email: typeof body.email === 'string' ? body.email.trim() : undefined,
      buyerTenantId: typeof body.tenantId === 'string' ? body.tenantId.trim() : typeof body.buyerTenantId === 'string' ? body.buyerTenantId.trim() : undefined,
      buyerCorpNum: usage === 'biz' ? identityNum : undefined,
      internalMemo: typeof body.memo === 'string' ? body.memo.trim() : typeof body.internalMemo === 'string' ? body.internalMemo.trim() : undefined,
      createdByPlatformUserId: user.platformUserId,
    });
    res.status(201).json(cashbillPublic(record));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '현금영수증 발행 실패' });
  }
});

router.post('/cashbills/:id/cancel', async (req, res) => {
  try {
    const record = await cancelPlatformCashBill(req.params.id);
    res.json({ ok: true, id: record.id });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '취소 실패' });
  }
});

router.get('/cashbills/month-stats', async (req, res) => {
  const parsed = parsePlatformReceiptListQuery(req.query as Record<string, unknown>);
  const result = await platformCashBillStats({
    fromYmd: parsed.fromYmd,
    toYmd: parsed.toYmd,
    status: parsed.status,
    q: parsed.q,
  });
  res.json({
    count: result.count,
    costKrw: result.costKrw,
    totalAmountKrw: result.totalWon,
    supplyAmountKrw: result.supplyWon,
    vatAmountKrw: result.taxWon,
  });
});

router.get('/tax-invoices', async (req, res) => {
  const parsed = parsePlatformReceiptListQuery(req.query as Record<string, unknown>);
  const buyerTenantId = typeof req.query.buyerTenantId === 'string' ? req.query.buyerTenantId.trim() : undefined;
  const result = await listPlatformTaxInvoices({
    limit: parsed.limit,
    offset: parsed.offset,
    buyerTenantId,
    fromYmd: parsed.fromYmd,
    toYmd: parsed.toYmd,
    status: parsed.status,
    q: parsed.q,
  });
  const names = await tenantNameMap(result.items.map((r) => r.buyerTenantId));
  res.json({
    total: result.total,
    items: result.items.map((row) => ({
      ...taxInvoicePublic(row),
      tenantName: row.buyerTenantId ? names.get(row.buyerTenantId) ?? null : null,
    })),
  });
});

router.get('/tax-invoices/export', async (req, res) => {
  try {
    const parsed = parsePlatformReceiptListQuery(req.query as Record<string, unknown>);
    const rows = await listPlatformTaxInvoicesForExport({
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      status: parsed.status,
      q: parsed.q,
    });
    const names = await tenantNameMap(rows.map((r) => r.buyerTenantId));
    const excelRows = rows.map((row) => {
      const pub = taxInvoicePublic(row);
      return {
        거래일: pub.writeDate,
        '업체/고객': names.get(row.buyerTenantId ?? '') || row.buyerCorpName || '',
        용도: pub.usageLabel,
        공급가: pub.supplyAmountKrw,
        부가세: pub.vatAmountKrw,
        합계: pub.totalAmountKrw,
        상태: pub.status === 'ISSUED' ? '발행' : pub.status === 'CANCELLED' ? '취소' : '실패',
        '국세청 승인번호': row.ntsSendKey ?? '',
      };
    });
    sendXlsx(res, `플랫폼_세금계산서_${parsed.fromYmd || 'all'}_${parsed.toYmd || 'all'}.xlsx`, excelRows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '엑셀 내보내기 실패' });
  }
});

router.post('/tax-invoices', async (req, res) => {
  const user = (req as PlatformScopedRequest).platformUser;
  try {
    const body = req.body as Record<string, unknown>;
    const writeDate = ymd8(String(body.writeDate ?? ''));
    if (writeDate.length !== 8) {
      res.status(400).json({ error: '작성일자를 확인해 주세요.' });
      return;
    }
    const buyerCorpNum = String(body.corpNum ?? body.buyerCorpNum ?? '').replace(/\D/g, '');
    if (!buyerCorpNum) {
      res.status(400).json({ error: '매입자 사업자번호를 입력해 주세요.' });
      return;
    }
    const buyerCorpName = String(body.corpName ?? body.buyerCorpName ?? '').trim();
    if (!buyerCorpName) {
      res.status(400).json({ error: '매입자 상호를 입력해 주세요.' });
      return;
    }
    const supply = Math.trunc(Number(body.supplyAmountKrw ?? body.supply ?? 0));
    if (!Number.isFinite(supply) || supply < 0) {
      res.status(400).json({ error: '공급가액을 확인해 주세요.' });
      return;
    }
    const tax = Math.trunc(Number(body.vatAmountKrw ?? body.tax ?? Math.round(supply * 0.1)));
    const itemName = String(body.itemName ?? '청소비서 이용료').trim() || '청소비서 이용료';
    const purposeType = Number(body.purposeType) === 2 ? 2 : 1;

    const record = await issuePlatformTaxInvoice({
      purposeType: purposeType as 1 | 2,
      writeDate,
      buyerCorpNum,
      buyerCorpName,
      buyerCeoName: typeof body.ceoName === 'string' ? body.ceoName.trim() : typeof body.buyerCeoName === 'string' ? body.buyerCeoName.trim() : '',
      buyerAddr: typeof body.addr === 'string' ? body.addr.trim() : typeof body.buyerAddr === 'string' ? body.buyerAddr.trim() : '',
      buyerEmail: typeof body.email === 'string' ? body.email.trim() : typeof body.buyerEmail === 'string' ? body.buyerEmail.trim() : '',
      buyerContactName: typeof body.buyerContactName === 'string' ? body.buyerContactName.trim() : '',
      buyerBizType: typeof body.bizType === 'string' ? body.bizType.trim() : '',
      buyerBizClass: typeof body.bizClass === 'string' ? body.bizClass.trim() : '',
      supply,
      tax,
      lines: [{ name: itemName, supply, tax }],
      internalMemo: typeof body.memo === 'string' ? body.memo.trim() : typeof body.internalMemo === 'string' ? body.internalMemo.trim() : undefined,
      buyerTenantId: typeof body.tenantId === 'string' ? body.tenantId.trim() : typeof body.buyerTenantId === 'string' ? body.buyerTenantId.trim() : undefined,
      createdByPlatformUserId: user.platformUserId,
    });
    res.status(201).json(taxInvoicePublic(record));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '세금계산서 발행 실패' });
  }
});

router.post('/tax-invoices/:id/cancel', async (req, res) => {
  try {
    await cancelPlatformTaxInvoice(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '취소 실패' });
  }
});

router.get('/tax-invoices/month-stats', async (req, res) => {
  const parsed = parsePlatformReceiptListQuery(req.query as Record<string, unknown>);
  const result = await platformTaxInvoiceStats({
    fromYmd: parsed.fromYmd,
    toYmd: parsed.toYmd,
    status: parsed.status,
    q: parsed.q,
  });
  res.json({
    count: result.count,
    costKrw: result.costKrw,
    totalAmountKrw: result.totalWon,
    supplyAmountKrw: result.supplyWon,
    vatAmountKrw: result.taxWon,
  });
});

router.get('/tenants-for-buyer', async (_req, res) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, config: true },
  });
  const items = tenants.map((t) => {
    const cfg = (t.config as Record<string, unknown> | null) ?? {};
    const cr = (cfg.companyRegistration as Record<string, string> | undefined) ?? {};
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      corpNum: (cr.businessRegistrationNo ?? '').replace(/\D/g, '') || null,
      corpName: cr.companyName?.trim() || null,
      ceoName: cr.representativeName?.trim() || null,
      addr: cr.addressLine?.trim() || null,
      bizType: null,
      bizClass: null,
      email: cr.contactEmail?.trim() || null,
      businessRegistrationNo: cr.businessRegistrationNo ?? '',
      companyName: cr.companyName ?? '',
      representativeName: cr.representativeName ?? '',
      addressLine: cr.addressLine ?? '',
      contactEmail: cr.contactEmail ?? '',
    };
  });
  res.json({ items });
});

router.post('/wallet-invoices/:paymentId/retry', async (req, res) => {
  try {
    await retryFailedWalletInvoice(req.params.paymentId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : '재시도 실패' });
  }
});

export default router;
