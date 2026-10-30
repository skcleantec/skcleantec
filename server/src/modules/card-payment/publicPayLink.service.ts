import { companyTrustFromLoaded } from '../orderform/publicOrderFormCompanyTrust.js';
import { prisma } from '../../lib/prisma.js';
import { splitTaxIncluded } from './cardVat.js';

export type PublicPayLinkState = 'wait' | 'done' | 'expired' | 'cancelled';

export type PublicPayLinkView = {
  state: PublicPayLinkState;
  sellerName: string;
  footerName: string;
  representativeName: string | null;
  bizNo: string | null;
  address: string | null;
  supportPhone: string | null;
  statementName: string;
  amountKrw: number;
  supplyKrw: number;
  vatKrw: number;
  goodsName: string;
  serviceDateLabel: string | null;
  customerMasked: string | null;
  orderNo: string | null;
  deadlineLabel: string | null;
  paidAtLabel: string | null;
  cardLabel: string | null;
  approvalNo: string | null;
  cancelledAtLabel: string | null;
  offTitle: string | null;
};

const SERVICE_BRIDGE = {
  sellerName: '서비스브릿지',
  footerName: '(주)서비스브릿지',
  representativeName: '이정무',
  bizNo: '138-87-04035',
  address: '인천광역시 연수구 송도미래로 30, 이동 801호, 엠46(송도동, 스마트밸리지식산업센터)',
};

const WEEK: Record<string, string> = { Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' };

function part(date: Date, type: Intl.DateTimeFormatPartTypes): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find((item) => item.type === type)?.value ?? '';
}

function kstDay(date: Date): string {
  return `${part(date, 'month')}월 ${part(date, 'day')}일 (${WEEK[part(date, 'weekday')] ?? ''})`;
}

function kstStamp(date: Date): string {
  return `${part(date, 'month')}월 ${part(date, 'day')}일 ${part(date, 'hour')}:${part(date, 'minute')}`;
}

export function maskPersonName(raw: string | null | undefined): string | null {
  const name = (raw ?? '').trim();
  if (!name) return null;
  const chars = [...name];
  if (chars.length <= 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function kstYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

async function serviceBridgePayNo(row: { id: string; createdAt: Date }): Promise<string> {
  const ymd = kstYmd(row.createdAt);
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const earlier = await prisma.usageFeeCardPayment.count({
    where: {
      AND: [
        { createdAt: { gte: start, lt: end } },
        {
          OR: [
            { createdAt: { lt: row.createdAt } },
            { createdAt: row.createdAt, id: { lt: row.id } },
          ],
        },
      ],
    },
  });
  return `SB-${ymd.slice(5, 7)}${ymd.slice(8, 10)}-${earlier + 1}`;
}

function sellerFromTrust(trust: {
  companyName: string;
  representativeName: string | null;
  businessRegistrationNo: string | null;
  addressLine: string | null;
  phone: string | null;
} | null, fallbackName: string) {
  const sellerName = trust?.companyName?.trim() || fallbackName;
  return {
    sellerName,
    footerName: sellerName,
    representativeName: trust?.representativeName ?? null,
    bizNo: trust?.businessRegistrationNo ?? null,
    address: trust?.addressLine ?? null,
    supportPhone: trust?.phone ?? null,
    statementName: sellerName,
  };
}

export async function buildTenantPayLinkView(tokenHash: string): Promise<PublicPayLinkView | null> {
  const row = await prisma.cardPayment.findFirst({
    where: { linkTokenHash: tokenHash },
    include: {
      tenant: { select: { name: true, config: true } },
      inquiry: {
        select: {
          preferredDate: true,
          operatingCompany: { select: { name: true, config: true } },
        },
      },
    },
  });
  if (!row) return null;
  const trust = companyTrustFromLoaded({
    tenantConfig: row.tenant.config,
    operatingCompany: row.inquiry?.operatingCompany ?? null,
    displayNameFallback: row.inquiry?.operatingCompany?.name || row.tenant.name,
  });
  const seller = sellerFromTrust(trust, row.tenant.name);
  const expired = Boolean(row.linkExpiresAt && row.linkExpiresAt.getTime() < Date.now());
  const split = splitTaxIncluded(row.amountWon);
  let state: PublicPayLinkState = 'wait';
  let offTitle: string | null = null;
  if (row.status === 'APPROVED') state = 'done';
  else if (row.status === 'CANCELLED') state = 'cancelled';
  else if (row.status === 'FAILED') {
    state = 'expired';
    offTitle = '이 링크는 더 이상 결제할 수 없어요';
  } else if (expired) {
    state = 'expired';
    offTitle = '결제 기한이 지났어요';
  }
  return {
    ...seller,
    state,
    ...split,
    amountKrw: row.amountWon,
    goodsName: row.goodsName?.trim() || '청소 서비스',
    serviceDateLabel: row.inquiry?.preferredDate ? kstDay(row.inquiry.preferredDate) : null,
    customerMasked: maskPersonName(row.customerName),
    orderNo: row.inquiryNumber?.trim() || null,
    deadlineLabel: row.linkExpiresAt ? `${kstStamp(row.linkExpiresAt)}까지` : null,
    paidAtLabel: row.paidAt ? kstStamp(row.paidAt) : null,
    cardLabel: row.cardLast4 ? `····${row.cardLast4}` : null,
    approvalNo: row.approvalNo,
    cancelledAtLabel: row.status === 'CANCELLED' ? kstStamp(row.updatedAt) : null,
    offTitle,
  };
}

export async function buildServiceBridgePayLinkView(token: string): Promise<PublicPayLinkView | null> {
  const row = await prisma.usageFeeCardPayment.findFirst({
    where: { linkToken: token },
    include: {
      tenant: { select: { name: true } },
    },
  });
  if (!row) return null;
  const inquiry = row.inquiryId
    ? await prisma.inquiry.findFirst({
        where: { id: row.inquiryId, ...(row.tenantId ? { tenantId: row.tenantId } : {}) },
        select: { preferredDate: true },
      })
    : null;
  const timedOut = row.status === 'PENDING' && Boolean(row.linkExpiresAt && row.linkExpiresAt.getTime() <= Date.now());
  const closedByHand = row.status === 'PENDING' && Boolean(row.linkClosedAt);
  let state: PublicPayLinkState = 'wait';
  let offTitle: string | null = null;
  if (row.status === 'APPROVED') state = 'done';
  else if (row.status === 'CANCELLED') state = 'cancelled';
  else if (row.status === 'FAILED' || closedByHand) {
    state = 'expired';
    offTitle = '이 링크는 닫혔어요';
  } else if (timedOut) {
    state = 'expired';
    offTitle = '결제 기한이 지났어요';
  }
  const split = splitTaxIncluded(row.amountKrw, row.supplyAmountKrw, row.vatAmountKrw);
  return {
    state,
    sellerName: SERVICE_BRIDGE.sellerName,
    footerName: SERVICE_BRIDGE.footerName,
    representativeName: SERVICE_BRIDGE.representativeName,
    bizNo: SERVICE_BRIDGE.bizNo,
    address: SERVICE_BRIDGE.address,
    supportPhone: null,
    statementName: SERVICE_BRIDGE.sellerName,
    amountKrw: row.amountKrw,
    ...split,
    goodsName: row.goodsName,
    serviceDateLabel: inquiry?.preferredDate ? kstDay(inquiry.preferredDate) : null,
    customerMasked: maskPersonName(row.buyerName),
    orderNo: await serviceBridgePayNo(row),
    deadlineLabel: row.linkExpiresAt ? `${kstStamp(row.linkExpiresAt)}까지` : null,
    paidAtLabel: row.status === 'APPROVED' ? kstStamp(row.paidAt) : null,
    cardLabel: row.cardLast4 ? `····${row.cardLast4}` : null,
    approvalNo: row.approvalNo,
    cancelledAtLabel: null,
    offTitle,
  };
}
