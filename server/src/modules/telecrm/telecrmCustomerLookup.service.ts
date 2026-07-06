import { prisma } from '../../lib/prisma.js';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import {
  serializeTelecrmInquiryBrief,
  telecrmInquiryBriefSelect,
} from './telecrmInquiryBrief.helpers.js';
import {
  getLatestTelecrmConsultationQuoteSummary,
  type TelecrmConsultationQuoteDto,
} from './telecrmConsultationQuote.service.js';

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

export type TelecrmCustomerCandidate = {
  key: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  lastAddress: string | null;
  inquiryCount: number;
  latestAt: string;
};

export type TelecrmCustomerLookupResult = {
  match: 'existing' | 'new' | 'pick';
  searchBy: 'phone' | 'name';
  candidates: TelecrmCustomerCandidate[];
  customer: {
    name: string | null;
    nickname: string | null;
    phone: string;
    lastAddress: string | null;
  };
  inquiries: ReturnType<typeof serializeTelecrmInquiryBrief>[];
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
  latestQuote: TelecrmConsultationQuoteDto | null;
};

function emptyResult(
  searchBy: 'phone' | 'name',
  phoneFallback = '',
): TelecrmCustomerLookupResult {
  return {
    match: 'new',
    searchBy,
    candidates: [],
    customer: { name: null, nickname: null, phone: phoneFallback.trim(), lastAddress: null },
    inquiries: [],
    followups: [],
    csReports: [],
    latestQuote: null,
  };
}

type CandidateAcc = {
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  lastAddress: string | null;
  inquiryCount: number;
  latestAt: Date;
};

function upsertCandidate(
  map: Map<string, CandidateAcc>,
  phoneRaw: string,
  patch: Partial<CandidateAcc> & { customerName: string; latestAt: Date },
) {
  const key = normalizeKrPhoneDigits(phoneRaw);
  if (key.length < 4) return;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, {
      customerName: patch.customerName,
      nickname: patch.nickname ?? null,
      customerPhone: phoneRaw.trim() || phoneRaw,
      lastAddress: patch.lastAddress ?? null,
      inquiryCount: patch.inquiryCount ?? 1,
      latestAt: patch.latestAt,
    });
    return;
  }
  if (patch.latestAt > prev.latestAt) {
    prev.customerName = patch.customerName;
    prev.nickname = patch.nickname ?? prev.nickname;
    prev.lastAddress = patch.lastAddress ?? prev.lastAddress;
    prev.latestAt = patch.latestAt;
  }
  prev.inquiryCount += patch.inquiryCount ?? 1;
}

function mapToCandidates(map: Map<string, CandidateAcc>): TelecrmCustomerCandidate[] {
  return [...map.entries()]
    .map(([key, row]) => ({
      key,
      customerName: row.customerName,
      nickname: row.nickname,
      customerPhone: row.customerPhone,
      lastAddress: row.lastAddress,
      inquiryCount: row.inquiryCount,
      latestAt: row.latestAt.toISOString(),
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

async function resolveTelecrmCustomerByPhone(
  tenantId: string,
  rawPhone: string,
  searchBy: 'phone' | 'name' = 'phone',
): Promise<TelecrmCustomerLookupResult> {
  const phoneDigits = normalizeKrPhoneDigits(rawPhone);
  const empty = emptyResult(searchBy, rawPhone);
  if (phoneDigits.length < 4) return empty;

  const last4 = phoneDigits.slice(-4);

  const [inquiryRows, followupRows, csRows, latestQuote] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        tenantId,
        OR: [{ customerPhone: { endsWith: last4 } }, { customerPhone2: { endsWith: last4 } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: telecrmInquiryBriefSelect,
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
    getLatestTelecrmConsultationQuoteSummary(tenantId, phoneDigits),
  ]);

  const inquiries = inquiryRows
    .filter(
      (row) =>
        phonesMatch(row.customerPhone, phoneDigits) ||
        (row.customerPhone2 != null && phonesMatch(row.customerPhone2, phoneDigits)),
    )
    .slice(0, 20)
    .map(serializeTelecrmInquiryBrief);

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

  const hasData =
    inquiries.length > 0 || followups.length > 0 || csReports.length > 0 || latestQuote != null;
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
    searchBy,
    candidates: [],
    customer: {
      name,
      nickname,
      phone: rawPhone.trim(),
      lastAddress: latestInquiry?.address?.trim() || null,
    },
    inquiries,
    followups,
    csReports,
    latestQuote,
  };
}

async function searchTelecrmCustomerByName(
  tenantId: string,
  rawName: string,
): Promise<TelecrmCustomerLookupResult> {
  const nameTrim = rawName.trim();
  const empty = emptyResult('name');
  if (nameTrim.length < 2) return empty;

  const nameFilter = { contains: nameTrim, mode: 'insensitive' as const };

  const [inquiryRows, followupRows, csRows] = await Promise.all([
    prisma.inquiry.findMany({
      where: { tenantId, customerName: nameFilter },
      orderBy: { createdAt: 'desc' },
      take: 120,
      select: {
        customerName: true,
        nickname: true,
        customerPhone: true,
        address: true,
        createdAt: true,
      },
    }),
    prisma.orderFollowup.findMany({
      where: { tenantId, customerName: nameFilter },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        customerName: true,
        nickname: true,
        customerPhone: true,
        createdAt: true,
      },
    }),
    prisma.csReport.findMany({
      where: { tenantId, customerName: nameFilter },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        customerName: true,
        customerPhone: true,
        createdAt: true,
      },
    }),
  ]);

  const map = new Map<string, CandidateAcc>();

  for (const row of inquiryRows) {
    upsertCandidate(map, row.customerPhone, {
      customerName: row.customerName,
      nickname: row.nickname,
      lastAddress: row.address?.trim() || null,
      latestAt: row.createdAt,
      inquiryCount: 1,
    });
  }
  for (const row of followupRows) {
    upsertCandidate(map, row.customerPhone, {
      customerName: row.customerName,
      nickname: row.nickname,
      latestAt: row.createdAt,
      inquiryCount: 0,
    });
  }
  for (const row of csRows) {
    upsertCandidate(map, row.customerPhone, {
      customerName: row.customerName,
      latestAt: row.createdAt,
      inquiryCount: 0,
    });
  }

  const candidates = mapToCandidates(map);
  if (candidates.length === 0) return empty;
  if (candidates.length === 1) {
    const resolved = await resolveTelecrmCustomerByPhone(tenantId, candidates[0]!.customerPhone, 'name');
    return { ...resolved, searchBy: 'name', candidates: [] };
  }

  return {
    match: 'pick',
    searchBy: 'name',
    candidates,
    customer: { name: nameTrim, nickname: null, phone: '', lastAddress: null },
    inquiries: [],
    followups: [],
    csReports: [],
    latestQuote: null,
  };
}

export async function lookupTelecrmCustomer(
  tenantId: string,
  rawPhone: string,
): Promise<TelecrmCustomerLookupResult> {
  return resolveTelecrmCustomerByPhone(tenantId, rawPhone, 'phone');
}

export async function searchTelecrmCustomer(
  tenantId: string,
  params: { phone?: string; name?: string },
): Promise<TelecrmCustomerLookupResult> {
  const phone = params.phone?.trim() ?? '';
  const name = params.name?.trim() ?? '';
  if (phone) return resolveTelecrmCustomerByPhone(tenantId, phone, 'phone');
  if (name) return searchTelecrmCustomerByName(tenantId, name);
  return emptyResult('phone');
}
