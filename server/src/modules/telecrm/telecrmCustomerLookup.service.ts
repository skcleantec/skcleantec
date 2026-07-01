import { prisma } from '../../lib/prisma.js';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';

function phonesMatch(a: string, b: string): boolean {
  const da = normalizeKrPhoneDigits(a);
  const db = normalizeKrPhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const ta = da.slice(-11);
  const tb = db.slice(-11);
  if (ta === tb) return true;
  const ta10 = da.slice(-10);
  const tb10 = db.slice(-10);
  return ta10.length === 10 && tb10.length === 10 && ta10 === tb10;
}

export type TelecrmCustomerLookupResult = {
  match: 'existing' | 'new';
  customer: {
    name: string | null;
    nickname: string | null;
    phone: string;
    lastAddress: string | null;
  };
  inquiries: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    nickname: string | null;
    customerPhone: string;
    memo: string | null;
    address: string;
    areaPyeong: number | null;
  }[];
  followups: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    nickname: string | null;
    customerPhone: string;
    memo: string | null;
    inquiryId: string | null;
  }[];
  csReports: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    content: string;
    memo: string | null;
    inquiryId: string | null;
  }[];
};

export async function lookupTelecrmCustomer(
  tenantId: string,
  rawPhone: string,
): Promise<TelecrmCustomerLookupResult> {
  const phoneDigits = normalizeKrPhoneDigits(rawPhone);
  const empty: TelecrmCustomerLookupResult = {
    match: 'new',
    customer: { name: null, nickname: null, phone: rawPhone.trim(), lastAddress: null },
    inquiries: [],
    followups: [],
    csReports: [],
  };
  if (phoneDigits.length < 4) return empty;

  const last4 = phoneDigits.slice(-4);

  const [inquiryRows, followupRows, csRows] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        tenantId,
        OR: [{ customerPhone: { endsWith: last4 } }, { customerPhone2: { endsWith: last4 } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        memo: true,
        address: true,
        areaPyeong: true,
      },
    }),
    prisma.orderFollowup.findMany({
      where: { tenantId, customerPhone: { endsWith: last4 } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        memo: true,
        inquiryId: true,
      },
    }),
    prisma.csReport.findMany({
      where: { tenantId, customerPhone: { endsWith: last4 } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerName: true,
        customerPhone: true,
        content: true,
        memo: true,
        inquiryId: true,
      },
    }),
  ]);

  const inquiries = inquiryRows
    .filter(
      (row) =>
        phonesMatch(row.customerPhone, phoneDigits) ||
        (row.customerPhone2 != null && phonesMatch(row.customerPhone2, phoneDigits)),
    )
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      customerName: row.customerName,
      nickname: row.nickname,
      customerPhone: row.customerPhone,
      memo: row.memo,
      address: row.address,
      areaPyeong: row.areaPyeong,
    }));

  const followups = followupRows
    .filter((row) => phonesMatch(row.customerPhone, phoneDigits))
    .slice(0, 15)
    .map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      customerName: row.customerName,
      nickname: row.nickname,
      customerPhone: row.customerPhone,
      memo: row.memo,
      inquiryId: row.inquiryId,
    }));

  const csReports = csRows
    .filter((row) => phonesMatch(row.customerPhone, phoneDigits))
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      content: row.content,
      memo: row.memo,
      inquiryId: row.inquiryId,
    }));

  const hasData = inquiries.length > 0 || followups.length > 0 || csReports.length > 0;
  const latestInquiry = inquiries[0];
  const latestFollowup = followups[0];

  const name =
    latestInquiry?.customerName ??
    latestFollowup?.customerName ??
    csReports[0]?.customerName ??
    null;
  const nickname = latestInquiry?.nickname ?? latestFollowup?.nickname ?? null;

  return {
    match: hasData ? 'existing' : 'new',
    customer: {
      name,
      nickname,
      phone: rawPhone.trim(),
      lastAddress: latestInquiry?.address?.trim() || null,
    },
    inquiries,
    followups,
    csReports,
  };
}
