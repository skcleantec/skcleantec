import { Router } from 'express';
import { platformAuthMiddleware, type PlatformScopedRequest } from '../platform/platformAuth.middleware.js';
import { maskIssuer, readPlatformIssuer, refreshPlatformIssuerCert, platformIssuerCertRegisterUrl } from './platformIssuer.js';
import {
  issuePlatformCashBill,
  cancelPlatformCashBill,
  listPlatformCashBills,
  platformCashBillMonthStats,
} from './platformCashbill.service.js';
import {
  issuePlatformTaxInvoice,
  cancelPlatformTaxInvoice,
  listPlatformTaxInvoices,
  platformTaxInvoiceMonthStats,
} from './platformTaxInvoice.service.js';
import { retryFailedWalletInvoice } from './platformWalletInvoice.service.js';
import { prisma } from '../../lib/prisma.js';
import { splitCashbillTax } from '../cashbill/cashbillIssue.amounts.js';

const router = Router();
router.use(platformAuthMiddleware);

function kstYearMonth(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' })
    .format(date)
    .slice(0, 7);
}

function ymd8(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 8);
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
}) {
  const cancelled = row.kind === 'CANCEL' || Boolean(row.cancelOfId);
  const usage = row.identityMasked === '자진발급' ? 'voluntary' : row.tradeUsage === '2' ? 'biz' : 'phone';
  const taxKind = row.taxKind.includes('면') ? 'exempt' : 'taxable';
  return {
    id: row.id,
    status: row.lastError ? 'FAILED' : cancelled ? 'CANCELLED' : 'ISSUED',
    taxKind,
    usage,
    identity: row.identityMasked,
    itemName: row.itemName,
    amountKrw: row.totalWon,
    supplyAmountKrw: row.amount,
    vatAmountKrw: row.tax,
    tradeDate: row.tradeDate.length === 8
      ? `${row.tradeDate.slice(0, 4)}-${row.tradeDate.slice(4, 6)}-${row.tradeDate.slice(6, 8)}`
      : row.tradeDate,
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
  };
}

function taxInvoicePublic(row: {
  id: string;
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
    writeDate: row.writeDate.length === 8
      ? `${row.writeDate.slice(0, 4)}-${row.writeDate.slice(4, 6)}-${row.writeDate.slice(6, 8)}`
      : row.writeDate,
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
  };
}

router.get('/issuer', (_req, res) => {
  try {
    const issuer = readPlatformIssuer();
    const masked = maskIssuer(issuer);
    const corp = issuer.corpNum.replace(/\D/g, '');
    res.json({
      ...masked,
      corpNumMasked: corp.length >= 10 ? `${corp.slice(0, 3)}-${corp.slice(3, 5)}-*****` : corp,
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
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const buyerTenantId = typeof req.query.buyerTenantId === 'string' ? req.query.buyerTenantId.trim() : undefined;
  const result = await listPlatformCashBills({ limit, offset, buyerTenantId });
  const tenantIds = [...new Set(result.items.map((r) => r.buyerTenantId).filter((id): id is string => Boolean(id)))];
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  res.json({
    total: result.total,
    items: result.items.map((row) => ({
      ...cashbillPublic(row),
      tenantName: row.buyerTenantId ? names.get(row.buyerTenantId) ?? null : null,
    })),
  });
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
  const yearMonth = typeof req.query.yearMonth === 'string' && /^\d{4}-\d{2}$/.test(req.query.yearMonth)
    ? req.query.yearMonth
    : kstYearMonth();
  const result = await platformCashBillMonthStats(yearMonth);
  res.json({
    count: result.count,
    costKrw: result.costKrw,
    totalAmountKrw: result.totalWon,
    supplyAmountKrw: result.supplyWon,
    vatAmountKrw: result.taxWon,
  });
});

router.get('/tax-invoices', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const buyerTenantId = typeof req.query.buyerTenantId === 'string' ? req.query.buyerTenantId.trim() : undefined;
  const result = await listPlatformTaxInvoices({ limit, offset, buyerTenantId });
  const tenantIds = [...new Set(result.items.map((r) => r.buyerTenantId).filter((id): id is string => Boolean(id)))];
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  res.json({
    total: result.total,
    items: result.items.map((row) => ({
      ...taxInvoicePublic(row),
      tenantName: row.buyerTenantId ? names.get(row.buyerTenantId) ?? null : null,
    })),
  });
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
  const yearMonth = typeof req.query.yearMonth === 'string' && /^\d{4}-\d{2}$/.test(req.query.yearMonth)
    ? req.query.yearMonth
    : kstYearMonth();
  const result = await platformTaxInvoiceMonthStats(yearMonth);
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
