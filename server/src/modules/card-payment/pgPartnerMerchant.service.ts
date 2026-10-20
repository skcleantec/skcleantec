import type { CardPaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { saveCredentialFromPlatform } from './cardPaymentCredential.service.js';
import { readSellerCenterLogin, saveSellerCenterLogin } from './cardPaymentSellerCenter.service.js';
import { olderSameInquiryCardPaymentIds } from './cardPaymentList.service.js';
import { getPlatformPgAgencyRow, platformAgencyListItem } from './platformPgAgency.service.js';

function slotOf(
  rows: Array<{ rail: string; mid: string | null; oid: string | null; tidMasked: string | null; apiKeyLast4: string | null; isActive: boolean }>,
  rail: 'KEYIN' | 'LINK',
) {
  const row = rows.find((item) => item.rail === rail);
  if (!row) return { connected: false as const };
  return {
    connected: true as const,
    isActive: row.isActive,
    mid: row.mid,
    oid: row.oid,
    tidMasked: row.tidMasked,
    apiKeyLast4: row.apiKeyLast4,
  };
}

export async function listPartnerMerchants() {
  const credentials = await prisma.tenantPgCredential.findMany({
    where: { isActive: true },
    select: { tenantId: true, rail: true, mid: true, oid: true, apiKeyLast4: true },
  });
  const tenantIds = [...new Set(credentials.map((row) => row.tenantId))];
  const agency = platformAgencyListItem(await getPlatformPgAgencyRow());
  if (tenantIds.length === 0) return [agency];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const onboardings = await prisma.tenantPgOnboarding.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { tenantId: true, businessName: true, bizNumber: true, contactPhone: true },
  });
  const onboardByTenant = new Map(onboardings.map((row) => [row.tenantId, row]));
  const rows = tenants.map((tenant) => {
    const slots = credentials.filter((row) => row.tenantId === tenant.id);
    const onboard = onboardByTenant.get(tenant.id);
    const keyin = slots.find((row) => row.rail === 'KEYIN');
    const link = slots.find((row) => row.rail === 'LINK');
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      businessName: onboard?.businessName ?? null,
      bizNumber: onboard?.bizNumber ?? null,
      contactPhone: onboard?.contactPhone ?? null,
      keyinMid: keyin?.mid ?? null,
      linkMid: link?.mid ?? null,
      keyinKeyLast4: keyin?.apiKeyLast4 ?? null,
      linkKeyLast4: link?.apiKeyLast4 ?? null,
      role: 'MERCHANT' as const,
    };
  });
  return [agency, ...rows];
}

export async function getPartnerMerchant(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return null;
  const [credentials, onboard, seller] = await Promise.all([
    prisma.tenantPgCredential.findMany({
      where: { tenantId },
      select: { rail: true, mid: true, oid: true, tidMasked: true, apiKeyLast4: true, isActive: true },
    }),
    prisma.tenantPgOnboarding.findFirst({
      where: { tenantId },
      select: {
        businessName: true,
        bizNumber: true,
        representativeName: true,
        addressLine: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        bankName: true,
        bankAccount: true,
        accountHolder: true,
      },
    }),
    readSellerCenterLogin(tenantId),
  ]);
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    businessName: onboard?.businessName ?? null,
    bizNumber: onboard?.bizNumber ?? null,
    representativeName: onboard?.representativeName ?? null,
    addressLine: onboard?.addressLine ?? null,
    contactName: onboard?.contactName ?? null,
    contactPhone: onboard?.contactPhone ?? null,
    contactEmail: onboard?.contactEmail ?? null,
    bankName: onboard?.bankName ?? null,
    bankAccount: onboard?.bankAccount ?? null,
    accountHolder: onboard?.accountHolder ?? null,
    sellerLoginId: seller.loginId,
    sellerPasswordSet: Boolean(seller.password),
    keyin: slotOf(credentials, 'KEYIN'),
    link: slotOf(credentials, 'LINK'),
  };
}

type RailConnect = { mid: string; oid: string; tid: string; apiKey: string };

function assertRail(label: string, rail: RailConnect, expectKeyin: boolean) {
  const mid = rail.mid.trim();
  const oid = rail.oid.trim();
  const tid = rail.tid.trim();
  const apiKey = rail.apiKey.trim();
  if (!/^[A-Za-z0-9]{4,32}$/.test(mid)) throw new Error(`${label} MID는 영문·숫자 4~32자리여야 합니다.`);
  if (!/^[A-Za-z0-9]{4}$/.test(oid)) throw new Error(`${label} 주문번호 4자리를 확인해 주세요.`);
  if (!tid) throw new Error(`${label} TID를 입력해 주세요.`);
  if (!apiKey || /^\d{13,19}$/.test(apiKey.replace(/\s/g, ''))) throw new Error(`${label} API 키를 입력해 주세요. 카드번호는 받지 않습니다.`);
  if (expectKeyin && !apiKey.startsWith('ssp-')) throw new Error('수기 API 키는 ssp-로 시작해야 합니다.');
  if (!expectKeyin && apiKey.startsWith('ssp-')) throw new Error('인증 키는 결제창 mKey입니다. ssp- 키는 수기에 넣으세요.');
  return { mid, oid, tid, apiKey };
}

/** 수기·인증을 함께 저장하고 그 업체를 바로 사용할 수 있게 연다. */
export async function connectPartnerRails(
  tenantId: string,
  input: { sellerLoginId: string; sellerPassword: string; keyin: RailConnect; link: RailConnect },
) {
  const keyin = assertRail('수기', input.keyin, true);
  const link = assertRail('인증', input.link, false);
  await saveCredentialFromPlatform({ tenantId, rail: 'KEYIN', ...keyin });
  await saveCredentialFromPlatform({ tenantId, rail: 'LINK', ...link });
  await saveSellerCenterLogin(tenantId, input.sellerLoginId, input.sellerPassword);
}

const PENDING: CardPaymentStatus[] = ['DRAFT', 'AWAITING_PG', 'LINK_SENT'];

type PaymentRow = {
  id: string;
  kind: '청소' | '이용료';
  tenantName: string;
  customerName: string;
  customerPhone: string | null;
  inquiryNumber: string | null;
  method: string;
  status: string;
  amountWon: number;
  pgOrderId: string | null;
  cardLast4: string | null;
  approvalNo: string | null;
  paidAt: string | null;
  createdAt: string;
  failReason: string | null;
};

export async function listPartnerPayments(input: { status?: string; limit: number; offset: number }) {
  const cardWhere: Prisma.CardPaymentWhereInput = {};
  const feeWhere: Prisma.UsageFeeCardPaymentWhereInput = { payMethod: { in: ['KEYIN', 'PAY_WINDOW'] } };
  if (input.status === 'PENDING') {
    cardWhere.status = { in: PENDING };
    feeWhere.status = 'PENDING';
  } else if (input.status === 'APPROVED' || input.status === 'CANCELLED' || input.status === 'FAILED') {
    cardWhere.status = input.status;
    feeWhere.status = input.status;
  }
  const hiddenIds = await olderSameInquiryCardPaymentIds(cardWhere);
  if (hiddenIds.length > 0) cardWhere.id = { notIn: hiddenIds };
  const window = Math.min(1000, input.offset + input.limit);
  const [cards, fees, cardTotal, feeTotal] = await Promise.all([
    prisma.cardPayment.findMany({
      where: cardWhere,
      orderBy: { createdAt: 'desc' },
      take: window,
      select: {
        id: true,
        status: true,
        method: true,
        payRail: true,
        amountWon: true,
        customerName: true,
        inquiryNumber: true,
        approvalNo: true,
        pgOrderId: true,
        cardLast4: true,
        paidAt: true,
        createdAt: true,
        failReason: true,
        tenant: { select: { name: true } },
        inquiry: { select: { customerPhone: true, customerName: true } },
      },
    }),
    prisma.usageFeeCardPayment.findMany({
      where: feeWhere,
      orderBy: { createdAt: 'desc' },
      take: window,
      select: {
        id: true,
        status: true,
        payMethod: true,
        amountKrw: true,
        goodsName: true,
        buyerName: true,
        approvalNo: true,
        pgOrderId: true,
        cardLast4: true,
        paidAt: true,
        createdAt: true,
        memo: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.cardPayment.count({ where: cardWhere }),
    prisma.usageFeeCardPayment.count({ where: feeWhere }),
  ]);
  const rows: PaymentRow[] = [
    ...cards.map((row) => ({
      id: `card:${row.id}`,
      kind: '청소' as const,
      tenantName: row.tenant.name,
      customerName: row.customerName || row.inquiry?.customerName || '',
      customerPhone: row.inquiry?.customerPhone ?? null,
      inquiryNumber: row.inquiryNumber,
      method: row.payRail === 'PAY_WINDOW' ? '결제창' : row.method === 'CUSTOMER_LINK' ? '인증' : '수기',
      status: row.status,
      amountWon: row.amountWon,
      pgOrderId: row.pgOrderId,
      cardLast4: row.cardLast4,
      approvalNo: row.approvalNo,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      failReason: row.failReason,
    })),
    ...fees.map((row) => ({
      id: `fee:${row.id}`,
      kind: '이용료' as const,
      tenantName: row.tenant?.name ?? '플랫폼',
      customerName: row.buyerName || row.goodsName,
      customerPhone: null,
      inquiryNumber: null,
      method: row.payMethod === 'PAY_WINDOW' ? '결제창' : '수기',
      status: row.status,
      amountWon: row.amountKrw,
      pgOrderId: row.pgOrderId,
      cardLast4: row.cardLast4,
      approvalNo: row.approvalNo,
      paidAt: row.paidAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      failReason: row.memo,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: cardTotal + feeTotal, items: rows.slice(input.offset, input.offset + input.limit) };
}
