import { prisma } from '../../lib/prisma.js';
import { normalizeKrPhoneDigits } from '../cs/matchInquiryForCs.js';
import {
  serializeTelecrmInquiryBrief,
  telecrmInquiryBriefSelect,
} from './telecrmInquiryBrief.helpers.js';
import {
  getLatestTelecrmConsultationQuoteSummary,
  listSentTelecrmConsultationQuotes,
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
    /** 연락처2 (주로 050 안심번호) */
    customerPhone2: string | null;
    memo: string | null;
    inquiryId: string | null;
    goldDb: boolean;
    preferredMoveInCleaningDate: string | null;
    address: string | null;
    areaPyeong: number | null;
    roomCount: number | null;
    bathroomCount: number | null;
    balconyCount: number | null;
    isOneRoom: boolean;
    oneRoomLoft: boolean | null;
    oneRoomSlidingPartition: boolean | null;
    structureBalconyNonExpanded: boolean | null;
    structurePartitionWall: boolean | null;
    structureOutdoorTerrace: boolean | null;
    leadSource: string | null;
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
  /** 이 번호로 견적보내기 한 기록 — 최신순 (누가·언제·얼마) */
  sentQuotes: TelecrmConsultationQuoteDto[];
  /**
   * 작업 브랜드에는 기록이 없고 같은 업체의 다른 브랜드에만 있는 번호 —
   * 이름만 채워 알려 준다(목록·상태는 비움, match 는 'new' 유지).
   */
  otherBrand?: { id: string; name: string } | null;
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
    sentQuotes: [],
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

function isMobile010Digits(d: string): boolean {
  return /^010\d{8}$/.test(d);
}

/** 연락처1·2(010/050)를 같은 사람으로 묶기 위한 별칭 → 후보 키 */
type CandidateAliases = Map<string, string>;

function upsertCandidate(
  map: Map<string, CandidateAcc>,
  phoneRaw: string,
  patch: Partial<CandidateAcc> & { customerName: string; latestAt: Date },
  aliases?: CandidateAliases,
  phone2Raw?: string | null,
) {
  const d1 = normalizeKrPhoneDigits(phoneRaw);
  const d2 = normalizeKrPhoneDigits(phone2Raw ?? '');
  const own = [d1, d2].filter((d) => d.length >= 4);
  if (own.length === 0) return;
  if (d1.length < 4) {
    phoneRaw = phone2Raw ?? '';
  }
  let key = own[0]!;
  if (aliases) {
    const found = own.map((d) => aliases.get(d)).find((k): k is string => Boolean(k && map.has(k)));
    if (found) key = found;
    for (const d of own) aliases.set(d, key);
  }
  const prev = map.get(key);
  /** 같은 사람에 010 실제 번호가 보이면 대표 번호를 010으로 */
  const mobileRaw = [phoneRaw, phone2Raw ?? ''].find((r) => isMobile010Digits(normalizeKrPhoneDigits(r)));
  if (!prev && mobileRaw) phoneRaw = mobileRaw;
  if (prev) {
    if (mobileRaw && !isMobile010Digits(normalizeKrPhoneDigits(prev.customerPhone))) {
      prev.customerPhone = mobileRaw.trim();
    }
  }
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
  operatingCompanyId: string,
  rawPhone: string,
  searchBy: 'phone' | 'name' = 'phone',
): Promise<TelecrmCustomerLookupResult> {
  const phoneDigits = normalizeKrPhoneDigits(rawPhone);
  const empty = emptyResult(searchBy, rawPhone);
  if (phoneDigits.length < 4) return empty;

  const last4 = phoneDigits.slice(-4);

  const [inquiryRows, followupRows, csRows, sentQuotes] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        tenantId,
        operatingCompanyId,
        OR: [{ customerPhone: { endsWith: last4 } }, { customerPhone2: { endsWith: last4 } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: telecrmInquiryBriefSelect,
    }),
    prisma.orderFollowup.findMany({
      where: {
        tenantId,
        operatingCompanyId,
        OR: [{ customerPhone: { endsWith: last4 } }, { customerPhone2: { endsWith: last4 } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        memo: true,
        inquiryId: true,
        goldDb: true,
        preferredMoveInCleaningDate: true,
        address: true,
        areaPyeong: true,
        roomCount: true,
        bathroomCount: true,
        balconyCount: true,
        isOneRoom: true,
        oneRoomLoft: true,
        oneRoomSlidingPartition: true,
        structureBalconyNonExpanded: true,
        structurePartitionWall: true,
        structureOutdoorTerrace: true,
        leadSource: true,
      },
    }),
    prisma.csReport.findMany({
      where: {
        tenantId,
        customerPhone: { endsWith: last4 },
        inquiry: { operatingCompanyId },
      },
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
    listSentTelecrmConsultationQuotes(tenantId, operatingCompanyId, phoneDigits, 10),
  ]);
  const latestQuote = sentQuotes[0] ?? null;

  const inquiries = inquiryRows
    .filter(
      (row) =>
        phonesMatch(row.customerPhone, phoneDigits) ||
        (row.customerPhone2 != null && phonesMatch(row.customerPhone2, phoneDigits)),
    )
    .slice(0, 20)
    .map(serializeTelecrmInquiryBrief);

  const followups = followupRows
    .filter(
      (row) =>
        phonesMatch(row.customerPhone, phoneDigits) ||
        (row.customerPhone2 != null && phonesMatch(row.customerPhone2, phoneDigits)),
    )
    .slice(0, 15)
    .map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      customerName: row.customerName,
      nickname: row.nickname,
      customerPhone: row.customerPhone,
      customerPhone2: row.customerPhone2 ?? null,
      memo: row.memo,
      inquiryId: row.inquiryId,
      goldDb: row.goldDb,
      preferredMoveInCleaningDate: row.preferredMoveInCleaningDate ?? null,
      address: row.address ?? null,
      areaPyeong: row.areaPyeong ?? null,
      roomCount: row.roomCount ?? null,
      bathroomCount: row.bathroomCount ?? null,
      balconyCount: row.balconyCount ?? null,
      isOneRoom: row.isOneRoom === true,
      oneRoomLoft: row.isOneRoom === true ? row.oneRoomLoft ?? null : null,
      oneRoomSlidingPartition: row.isOneRoom === true ? row.oneRoomSlidingPartition ?? null : null,
      structureBalconyNonExpanded: row.structureBalconyNonExpanded ?? null,
      structurePartitionWall: row.structurePartitionWall ?? null,
      structureOutdoorTerrace: row.structureOutdoorTerrace ?? null,
      leadSource: row.leadSource ?? null,
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
    sentQuotes,
  };
}

async function searchTelecrmCustomerByName(
  tenantId: string,
  operatingCompanyId: string,
  rawName: string,
): Promise<TelecrmCustomerLookupResult> {
  const nameTrim = rawName.trim();
  const empty = emptyResult('name');
  if (nameTrim.length < 2) return empty;

  const nameFilter = { contains: nameTrim, mode: 'insensitive' as const };

  const [inquiryRows, followupRows, csRows] = await Promise.all([
    prisma.inquiry.findMany({
      // 이름 또는 숨고 닉네임으로 찾음
      where: { tenantId, operatingCompanyId, OR: [{ customerName: nameFilter }, { nickname: nameFilter }] },
      orderBy: { createdAt: 'desc' },
      take: 120,
      select: {
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        address: true,
        createdAt: true,
      },
    }),
    prisma.orderFollowup.findMany({
      where: { tenantId, operatingCompanyId, OR: [{ customerName: nameFilter }, { nickname: nameFilter }] },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        customerName: true,
        nickname: true,
        customerPhone: true,
        customerPhone2: true,
        createdAt: true,
      },
    }),
    prisma.csReport.findMany({
      where: { tenantId, customerName: nameFilter, inquiry: { operatingCompanyId } },
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
  const aliases: CandidateAliases = new Map();

  for (const row of inquiryRows) {
    upsertCandidate(
      map,
      row.customerPhone,
      {
        customerName: row.customerName,
        nickname: row.nickname,
        lastAddress: row.address?.trim() || null,
        latestAt: row.createdAt,
        inquiryCount: 1,
      },
      aliases,
      row.customerPhone2,
    );
  }
  for (const row of followupRows) {
    upsertCandidate(
      map,
      row.customerPhone,
      {
        customerName: row.customerName,
        nickname: row.nickname,
        latestAt: row.createdAt,
        inquiryCount: 0,
      },
      aliases,
      row.customerPhone2,
    );
  }
  for (const row of csRows) {
    upsertCandidate(
      map,
      row.customerPhone,
      {
        customerName: row.customerName,
        latestAt: row.createdAt,
        inquiryCount: 0,
      },
      aliases,
    );
  }

  const candidates = mapToCandidates(map);
  if (candidates.length === 0) return empty;
  if (candidates.length === 1) {
    const resolved = await resolveTelecrmCustomerByPhone(
      tenantId,
      operatingCompanyId,
      candidates[0]!.customerPhone,
      'name',
    );
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
    sentQuotes: [],
  };
}

/** 작업 브랜드에서 못 찾은 번호 → 같은 업체의 다른 브랜드에서 고객 이름만 찾아 붙임 */
async function withOtherBrandName(
  tenantId: string,
  operatingCompanyId: string,
  rawPhone: string,
  result: TelecrmCustomerLookupResult,
): Promise<TelecrmCustomerLookupResult> {
  if (result.match !== 'new' || result.customer.name) return result;
  if (normalizeKrPhoneDigits(rawPhone).length < 7) return result;
  try {
    const others = await prisma.operatingCompany.findMany({
      where: { tenantId, id: { not: operatingCompanyId } },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
      select: { id: true, name: true },
    });
    for (const oc of others) {
      const other = await resolveTelecrmCustomerByPhone(tenantId, oc.id, rawPhone, 'phone');
      if (other.match === 'existing' && other.customer.name) {
        return {
          ...result,
          customer: {
            ...result.customer,
            name: other.customer.name,
            nickname: other.customer.nickname,
          },
          otherBrand: { id: oc.id, name: oc.name },
        };
      }
    }
  } catch (e) {
    console.error('[telecrm/customer-lookup] other brand fallback', e);
  }
  return result;
}

export async function lookupTelecrmCustomer(
  tenantId: string,
  operatingCompanyId: string,
  rawPhone: string,
): Promise<TelecrmCustomerLookupResult> {
  const result = await resolveTelecrmCustomerByPhone(tenantId, operatingCompanyId, rawPhone, 'phone');
  return withOtherBrandName(tenantId, operatingCompanyId, rawPhone, result);
}

const BATCH_LOOKUP_MAX = 30;

export async function lookupTelecrmCustomersBatch(
  tenantId: string,
  operatingCompanyId: string,
  rawPhones: string[],
): Promise<{ items: Array<{ queryPhone: string } & TelecrmCustomerLookupResult> }> {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const raw of rawPhones) {
    const digits = normalizeKrPhoneDigits(typeof raw === 'string' ? raw : '');
    if (digits.length < 4 || seen.has(digits)) continue;
    seen.add(digits);
    phones.push(digits);
    if (phones.length >= BATCH_LOOKUP_MAX) break;
  }
  const items = await Promise.all(
    phones.map(async (queryPhone) => {
      const result = await lookupTelecrmCustomer(tenantId, operatingCompanyId, queryPhone);
      return { queryPhone, ...result };
    }),
  );
  return { items };
}

export async function searchTelecrmCustomer(
  tenantId: string,
  operatingCompanyId: string,
  params: { phone?: string; name?: string },
): Promise<TelecrmCustomerLookupResult> {
  const phone = params.phone?.trim() ?? '';
  const name = params.name?.trim() ?? '';
  if (phone) return lookupTelecrmCustomer(tenantId, operatingCompanyId, phone);
  if (name) return searchTelecrmCustomerByName(tenantId, operatingCompanyId, name);
  return emptyResult('phone');
}
