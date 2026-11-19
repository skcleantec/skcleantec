import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { summarizeExposAreas, type LedgerAreaRow, type QuickQuoteAreaSummary } from './quickQuoteBuildingArea.js';
import {
  ADDRESS_EMPTY_NOTICE,
  ADDRESS_PAGE_SIZE,
  AREA_EMPTY_NOTE,
  addressAnchorForms,
  addressAttemptAnchors,
  addressSearchAttempts,
  isKeywordAddressError,
  parseRelJibun,
  sanitizeAddressKeyword,
  SOFT_ADDRESS_ERRORS,
  sortAddressRows,
  type RelLot,
} from './quickQuoteAddressQuery.js';

const DAILY_CAP = 300;
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const AREA_RETRY_LOTS = 5;
const JUSO_SEARCH = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
const JUSO_DETAIL = 'https://business.juso.go.kr/addrlink/addrDetailApi.do';
const LEDGER_AREA = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo';
const LEDGER_TITLE = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';
const LEDGER_RECAP = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo';

export type QuickQuoteAddressHit = {
  road: string;
  jibun: string;
  building: string;
  apartment: boolean;
  relJibun: string;
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
  lnbrMnnm: string;
  lnbrSlno: string;
  mtYn: string;
};

export type QuickQuoteAddressPage = {
  items: QuickQuoteAddressHit[];
  total: number;
  page: number;
  notice: string | null;
};

export type QuickQuoteUnit = { floor: string; ho: string };

export type QuickQuoteAreasResult =
  | Exclude<QuickQuoteAreaSummary, { kind: 'empty' }>
  | { kind: 'building'; totalSqm: number; note: string }
  | { kind: 'empty'; note?: string };

type AddressKeys = {
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
};

type PlatKeys = AddressKeys & {
  lnbrMnnm: string;
  lnbrSlno: string;
  mtYn: string;
};

function envKey(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function cacheKey(parts: Record<string, string>): string {
  const stable = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key]}`)
    .join('&');
  return createHash('sha256').update(stable).digest('hex');
}

function kstDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function scrub(message: string): string {
  return message
    .replace(/serviceKey=[^&\s]+/gi, 'serviceKey')
    .replace(/confmKey=[^&\s]+/gi, 'confmKey')
    .slice(0, 180);
}

function logFail(where: string, e: unknown): void {
  const message = e instanceof Error ? scrub(e.message) : '';
  console.error(`[quick-quote] ${where} failed`, message);
}

async function takeLookupSlot(tenantId: string): Promise<boolean> {
  const dayKey = kstDay();
  const bumped = await prisma.quickQuoteLookupDay.updateMany({
    where: { tenantId, dayKey, count: { lt: DAILY_CAP } },
    data: { count: { increment: 1 } },
  });
  if (bumped.count === 1) return true;
  try {
    await prisma.quickQuoteLookupDay.create({ data: { tenantId, dayKey, count: 1 } });
    return true;
  } catch {
    const again = await prisma.quickQuoteLookupDay.updateMany({
      where: { tenantId, dayKey, count: { lt: DAILY_CAP } },
      data: { count: { increment: 1 } },
    });
    return again.count === 1;
  }
}

async function cached<T>(tenantId: string, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await prisma.quickQuoteAreaCache.findFirst({
    where: { tenantId, cacheKey: key, expiresAt: { gt: new Date() } },
  });
  if (hit) return hit.payload as T;
  if (!(await takeLookupSlot(tenantId))) throw new Error('LOOKUP_LIMIT');
  const value = await load();
  const expiresAt = new Date(Date.now() + CACHE_MS);
  await prisma.quickQuoteAreaCache.upsert({
    where: { tenantId_cacheKey: { tenantId, cacheKey: key } },
    create: {
      tenantId,
      cacheKey: key,
      payload: value as Prisma.InputJsonValue,
      expiresAt,
    },
    update: { payload: value as Prisma.InputJsonValue, expiresAt },
  });
  return value;
}

async function getJson(url: URL, timeoutMs = 12_000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error('LOOKUP_FAILED');
  return res.json();
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value === 'string') return [];
  if (Array.isArray(value)) {
    return value.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
  }
  if (typeof value === 'object') return [value as Record<string, unknown>];
  return [];
}

function text(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

type JusoPage = { rows: Record<string, unknown>[]; total: number; errorCode: string };

async function juso(url: string, keyName: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
  const page = await jusoPage(url, keyName, params);
  if (page.errorCode !== '0') throw new Error('LOOKUP_FAILED');
  return page.rows;
}

async function jusoPage(url: string, keyName: string, params: Record<string, string>): Promise<JusoPage> {
  const key = envKey(keyName);
  if (!key) throw new Error('LOOKUP_UNAVAILABLE');
  const target = new URL(url);
  target.searchParams.set('confmKey', key);
  target.searchParams.set('resultType', 'json');
  for (const [name, value] of Object.entries(params)) target.searchParams.set(name, value);
  let body: unknown;
  try {
    body = await getJson(target);
  } catch (e) {
    logFail('address', e);
    throw new Error('LOOKUP_FAILED');
  }
  const results = (body as { results?: { common?: { errorCode?: string; totalCount?: string }; juso?: unknown } })
    .results;
  const errorCode = String(results?.common?.errorCode ?? '');
  const total = Number(results?.common?.totalCount ?? 0);
  return {
    rows: asRows(results?.juso),
    total: Number.isFinite(total) ? total : 0,
    errorCode,
  };
}

function compactRelJibun(raw: string, keyword: string): string {
  const lots = parseRelJibun(raw);
  if (!lots.length) return '';
  const numbers = new Set((keyword.match(/\d{3,4}/g) ?? []).map((item) => String(Number(item))));
  const preferred = numbers.size ? lots.filter((lot) => numbers.has(String(Number(lot.bun)))) : [];
  const rest = lots.filter((lot) => !preferred.includes(lot));
  return [...preferred, ...rest]
    .slice(0, 12)
    .map((lot) => `${lot.mtYn === '1' ? '산 ' : ''}${lot.bun}${lot.ji !== '0' ? `-${lot.ji}` : ''}`)
    .join(', ');
}

function mapAddressHit(row: Record<string, unknown>, keyword: string): QuickQuoteAddressHit | null {
  const hit: QuickQuoteAddressHit = {
    road: text(row, ['roadAddr']),
    jibun: text(row, ['jibunAddr']),
    building: text(row, ['bdNm']),
    apartment: text(row, ['bdKdcd']) === '1',
    relJibun: compactRelJibun(text(row, ['relJibun']), keyword),
    admCd: text(row, ['admCd']),
    rnMgtSn: text(row, ['rnMgtSn']),
    udrtYn: text(row, ['udrtYn']) || '0',
    buldMnnm: text(row, ['buldMnnm']),
    buldSlno: text(row, ['buldSlno']) || '0',
    lnbrMnnm: text(row, ['lnbrMnnm']),
    lnbrSlno: text(row, ['lnbrSlno']) || '0',
    mtYn: text(row, ['mtYn']) || '0',
  };
  if (!hit.admCd || !hit.rnMgtSn || !hit.road) return null;
  return hit;
}

async function searchAddressOnce(keyword: string, page: number): Promise<JusoPage> {
  const clean = sanitizeAddressKeyword(keyword);
  const query = clean.length >= 2 ? clean : keyword.trim();
  let pageRes = await jusoPage(JUSO_SEARCH, 'JUSO_SEARCH_KEY', {
    currentPage: String(page),
    countPerPage: String(ADDRESS_PAGE_SIZE),
    keyword: query,
    addInfoYn: 'Y',
  });
  if (isKeywordAddressError(pageRes.errorCode)) {
    const again = sanitizeAddressKeyword(query);
    if (again.length >= 2 && again !== query) {
      pageRes = await jusoPage(JUSO_SEARCH, 'JUSO_SEARCH_KEY', {
        currentPage: String(page),
        countPerPage: String(ADDRESS_PAGE_SIZE),
        keyword: again,
        addInfoYn: 'Y',
      });
    }
  }
  if (pageRes.errorCode && pageRes.errorCode !== '0' && !SOFT_ADDRESS_ERRORS.has(pageRes.errorCode)) {
    throw new Error('LOOKUP_FAILED');
  }
  return pageRes;
}

function pad4(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '0000';
  return digits.padStart(4, '0').slice(-4);
}

function ledgerItems(body: unknown): Record<string, unknown>[] {
  const item = (body as { response?: { body?: { items?: { item?: unknown } } } }).response?.body?.items?.item;
  return asRows(item);
}

function ledgerOk(body: unknown): boolean {
  const code = String(
    (body as { response?: { header?: { resultCode?: string } } }).response?.header?.resultCode ?? '',
  );
  return code === '00' || code === '03';
}

async function ledger(url: string, params: Record<string, string>): Promise<unknown> {
  const key = envKey('BUILDING_LEDGER_API_KEY');
  if (!key) throw new Error('LOOKUP_UNAVAILABLE');
  const target = new URL(url);
  target.searchParams.set('serviceKey', key);
  target.searchParams.set('_type', 'json');
  for (const [name, value] of Object.entries(params)) {
    if (value) target.searchParams.set(name, value);
  }
  try {
    return await getJson(target, 20_000);
  } catch (e) {
    logFail('ledger', e);
    throw new Error('LOOKUP_FAILED');
  }
}

export async function searchQuickQuoteAddress(
  tenantId: string,
  keyword: string,
  page = 1,
): Promise<QuickQuoteAddressPage> {
  const q = keyword.trim();
  const currentPage = Math.min(20, Math.max(1, Math.floor(page) || 1));
  const key = cacheKey({ kind: 'address2', q, page: String(currentPage) });
  return cached(tenantId, key, async () => {
    const attempts = addressSearchAttempts(q);
    let found: JusoPage | null = null;
    for (const attempt of attempts) {
      const pageRes = await searchAddressOnce(attempt, currentPage);
      if (pageRes.errorCode !== '0' || !pageRes.rows.length) continue;
      const anchors = addressAttemptAnchors(q, attempt).flatMap(addressAnchorForms);
      if (anchors.length) {
        const mentioned = pageRes.rows.some((row) => {
          const blob = [text(row, ['roadAddr']), text(row, ['jibunAddr']), text(row, ['bdNm']), text(row, ['emdNm'])].join(' ');
          return anchors.some((anchor) => blob.includes(anchor));
        });
        if (!mentioned) continue;
      }
      found = pageRes;
      break;
    }
    if (!found) {
      return { items: [], total: 0, page: currentPage, notice: ADDRESS_EMPTY_NOTICE };
    }
    const ranked = sortAddressRows(
      found.rows.map((row) => ({
        ...row,
        bdKdcd: text(row, ['bdKdcd']),
        bdNm: text(row, ['bdNm']),
      })),
    );
    const items = ranked
      .map((row) => mapAddressHit(row, q))
      .filter((hit): hit is QuickQuoteAddressHit => hit != null);
    return { items, total: found.total, page: currentPage, notice: null };
  });
}

export async function listQuickQuoteUnits(
  tenantId: string,
  address: AddressKeys,
  dongNm?: string,
): Promise<{ dongs: string[]; units: QuickQuoteUnit[] }> {
  const dong = dongNm?.trim() ?? '';
  const key = cacheKey({ kind: dong ? 'units' : 'dongs', ...address, dong });
  return cached(tenantId, key, async () => {
    const params: Record<string, string> = {
      admCd: address.admCd,
      rnMgtSn: address.rnMgtSn,
      udrtYn: address.udrtYn,
      buldMnnm: address.buldMnnm,
      buldSlno: address.buldSlno,
      searchType: dong ? 'floorho' : 'dong',
    };
    if (dong) params.dongNm = dong;
    const rows = await juso(JUSO_DETAIL, 'JUSO_DETAIL_KEY', params);
    if (!dong) {
      const dongs = [...new Set(rows.map((row) => text(row, ['dongNm'])).filter(Boolean))];
      dongs.sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
      return { dongs, units: [] };
    }
    const seen = new Set<string>();
    const units: QuickQuoteUnit[] = [];
    for (const row of rows) {
      const ho = text(row, ['hoNm', 'ho', 'hoNo']);
      if (!ho) continue;
      const floor = text(row, ['floorNm', 'flrNm', 'flrNo', 'floor']);
      const id = `${floor}|${ho}`;
      if (seen.has(id)) continue;
      seen.add(id);
      units.push({ floor, ho });
    }
    units.sort((a, b) => a.floor.localeCompare(b.floor, 'ko', { numeric: true }) || a.ho.localeCompare(b.ho, 'ko', { numeric: true }));
    return { dongs: [], units };
  });
}

const LEDGER_PAGE_SIZES = [1000, 100];
const LEDGER_SPLIT_AT = 1000;

function ledgerTotal(body: unknown): number {
  const total = Number((body as { response?: { body?: { totalCount?: string } } }).response?.body?.totalCount ?? 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function toLedgerRow(item: Record<string, unknown>): LedgerAreaRow {
  return {
    exposPubuseGbCd: text(item, ['exposPubuseGbCd']),
    area: text(item, ['area']),
    dongNm: text(item, ['dongNm']),
    hoNm: text(item, ['hoNm']),
    flrGbCd: text(item, ['flrGbCd']),
    flrNo: text(item, ['flrNo']),
    mainPurpsCdNm: text(item, ['mainPurpsCdNm']),
    etcPurps: text(item, ['etcPurps']),
  };
}

function pageSignature(items: Record<string, unknown>[]): string {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return '';
  return `${text(first, ['dongNm'])}|${text(first, ['hoNm'])}|${text(first, ['area'])}|${text(last, ['hoNm'])}|${text(last, ['area'])}|${items.length}`;
}

async function fetchLedgerPage(
  base: Record<string, string>,
  page: number,
  sizeIndex = 0,
): Promise<{ items: Record<string, unknown>[]; total: number; size: number }> {
  const size = LEDGER_PAGE_SIZES[sizeIndex] ?? 100;
  const body = await ledger(LEDGER_AREA, { ...base, numOfRows: String(size), pageNo: String(page) });
  if (!ledgerOk(body)) {
    if (sizeIndex < LEDGER_PAGE_SIZES.length - 1) return fetchLedgerPage(base, page, sizeIndex + 1);
    throw new Error('LOOKUP_FAILED');
  }
  return { items: ledgerItems(body), total: ledgerTotal(body), size };
}

/** totalCount까지 페이지를 모두 읽는다. 같은 페이지가 반복되면 멈춘다. */
async function fetchAllLedgerPages(base: Record<string, string>): Promise<LedgerAreaRow[]> {
  const rows: LedgerAreaRow[] = [];
  let total = 0;
  let previous = '';
  let sizeIndex = 0;
  const pageCap = 400;
  for (let page = 1; page <= pageCap; page += 1) {
    const packed = await fetchLedgerPage(base, page, sizeIndex);
    const used = LEDGER_PAGE_SIZES.indexOf(packed.size);
    if (used >= 0) sizeIndex = used;
    if (page === 1) total = packed.total;
    if (!packed.items.length) break;
    const signature = pageSignature(packed.items);
    if (signature && signature === previous) break;
    previous = signature;
    for (const item of packed.items) rows.push(toLedgerRow(item));
    if (total > 0 && rows.length >= total) break;
    if (packed.items.length < packed.size && (total === 0 || rows.length >= total)) break;
  }
  return rows;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

async function listLedgerDongs(plat: PlatKeys): Promise<string[]> {
  try {
    const rows = await juso(JUSO_DETAIL, 'JUSO_DETAIL_KEY', {
      admCd: plat.admCd,
      rnMgtSn: plat.rnMgtSn,
      udrtYn: plat.udrtYn,
      buldMnnm: plat.buldMnnm,
      buldSlno: plat.buldSlno,
      searchType: 'dong',
    });
    return [...new Set(rows.map((row) => text(row, ['dongNm'])).filter(Boolean))];
  } catch {
    return [];
  }
}

async function fetchLedgerRows(plat: PlatKeys, dongNm: string, hoNm: string): Promise<LedgerAreaRow[]> {
  const base: Record<string, string> = {
    sigunguCd: plat.admCd.slice(0, 5),
    bjdongCd: plat.admCd.slice(5, 10),
    platGbCd: plat.mtYn === '1' ? '1' : '0',
    bun: pad4(plat.lnbrMnnm),
    ji: pad4(plat.lnbrSlno),
    ...(dongNm ? { dongNm } : {}),
    ...(hoNm ? { hoNm } : {}),
  };
  if (dongNm || hoNm) return fetchAllLedgerPages(base);

  const first = await fetchLedgerPage(base, 1);
  if (!first.items.length) return [];
  if (first.total > 0 && first.total <= LEDGER_SPLIT_AT) return fetchAllLedgerPages(base);

  const dongs = await listLedgerDongs(plat);
  if (dongs.length < 2) return fetchAllLedgerPages(base);
  const parts = await mapPool(dongs, 4, (dong) => fetchAllLedgerPages({ ...base, dongNm: dong }));
  const merged = parts.flat();
  if (!merged.length || (first.total > 0 && merged.length < first.total * 0.8)) return fetchAllLedgerPages(base);
  return merged;
}

function lotId(lot: RelLot): string {
  return `${lot.mtYn}:${pad4(lot.bun)}:${pad4(lot.ji)}`;
}

function platWithLot(plat: PlatKeys, lot: RelLot): PlatKeys {
  return { ...plat, lnbrMnnm: lot.bun, lnbrSlno: lot.ji, mtYn: lot.mtYn };
}

async function summarizePlat(plat: PlatKeys, dong: string, ho: string): Promise<QuickQuoteAreaSummary> {
  const rows = await fetchLedgerRows(plat, dong, ho);
  return summarizeExposAreas(rows, dong || ho ? { dongNm: dong, hoNm: ho } : undefined);
}

function lotsFromTitle(items: Record<string, unknown>[]): RelLot[] {
  const lots: RelLot[] = [];
  for (const item of items) {
    const bun = text(item, ['bun']);
    if (bun) {
      lots.push({
        bun,
        ji: text(item, ['ji']) || '0',
        mtYn: text(item, ['platGbCd']) === '1' ? '1' : '0',
      });
    }
    lots.push(...parseRelJibun(text(item, ['platPlc', 'newPlatPlc'])));
  }
  return lots;
}

async function fetchRepresentativeLots(plat: PlatKeys): Promise<RelLot[]> {
  const params = {
    sigunguCd: plat.admCd.slice(0, 5),
    bjdongCd: plat.admCd.slice(5, 10),
    platGbCd: plat.mtYn === '1' ? '1' : '0',
    bun: pad4(plat.lnbrMnnm),
    ji: pad4(plat.lnbrSlno),
    numOfRows: '5',
    pageNo: '1',
  };
  const lots: RelLot[] = [];
  for (const url of [LEDGER_RECAP, LEDGER_TITLE]) {
    try {
      const body = await ledger(url, params);
      if (!ledgerOk(body)) continue;
      lots.push(...lotsFromTitle(ledgerItems(body)));
    } catch (e) {
      if (e instanceof Error && e.message === 'LOOKUP_UNAVAILABLE') throw e;
    }
  }
  return lots;
}

async function fetchTitleSqm(plat: PlatKeys): Promise<number | null> {
  const body = await ledger(LEDGER_TITLE, {
    sigunguCd: plat.admCd.slice(0, 5),
    bjdongCd: plat.admCd.slice(5, 10),
    platGbCd: plat.mtYn === '1' ? '1' : '0',
    bun: pad4(plat.lnbrMnnm),
    ji: pad4(plat.lnbrSlno),
    numOfRows: '10',
    pageNo: '1',
  });
  if (!ledgerOk(body)) return null;
  const item = ledgerItems(body)[0];
  if (!item) return null;
  const total = Number(text(item, ['totArea']));
  return Number.isFinite(total) && total > 0 ? Math.round(total * 10) / 10 : null;
}

const EMPTY_AREAS = { kind: 'empty' as const, note: AREA_EMPTY_NOTE };

function orderedRelLots(relJibun: string, keyword: string): RelLot[] {
  const lots = parseRelJibun(relJibun);
  const numbers = new Set((keyword.match(/\d{3,4}/g) ?? []).map((item) => String(Number(item))));
  const preferred = numbers.size ? lots.filter((lot) => numbers.has(String(Number(lot.bun)))) : [];
  const rest = lots.filter((lot) => !preferred.includes(lot));
  const cap = preferred.length ? Math.min(8, preferred.length) : AREA_RETRY_LOTS;
  return [...preferred, ...rest].slice(0, cap);
}

export async function lookupQuickQuoteAreas(
  tenantId: string,
  plat: PlatKeys,
  dongNm?: string,
  hoNm?: string,
  relJibun?: string,
  keyword?: string,
): Promise<QuickQuoteAreasResult> {
  const dong = dongNm?.trim() ?? '';
  const ho = hoNm?.trim() ?? '';
  const related = (relJibun ?? '').trim().slice(0, 500);
  const typed = (keyword ?? '').trim().slice(0, 80);
  const key = cacheKey({ kind: 'areas3', ...plat, dong, ho, rel: related, q: typed });
  return cached(tenantId, key, async () => {
    let summary = await summarizePlat(plat, dong, ho);
    if (summary.kind !== 'empty') return summary;
    if (dong || ho) return EMPTY_AREAS;

    const tried = new Set<string>([
      lotId({ bun: plat.lnbrMnnm, ji: plat.lnbrSlno, mtYn: plat.mtYn === '1' ? '1' : '0' }),
    ]);
    const tryLot = async (lot: RelLot): Promise<QuickQuoteAreaSummary | null> => {
      const id = lotId(lot);
      if (tried.has(id)) return null;
      tried.add(id);
      const next = await summarizePlat(platWithLot(plat, lot), '', '');
      return next.kind === 'empty' ? null : next;
    };

    for (const lot of orderedRelLots(related, typed)) {
      const next = await tryLot(lot);
      if (next) return next;
    }
    for (const lot of await fetchRepresentativeLots(plat)) {
      if (tried.size > AREA_RETRY_LOTS + 4) break;
      const next = await tryLot(lot);
      if (next) return next;
    }

    const totalSqm = await fetchTitleSqm(plat);
    if (totalSqm == null) return EMPTY_AREAS;
    return {
      kind: 'building' as const,
      totalSqm,
      note: '이 주소는 집별 면적이 없어 건물 전체 면적만 보여 드려요.',
    };
  });
}
