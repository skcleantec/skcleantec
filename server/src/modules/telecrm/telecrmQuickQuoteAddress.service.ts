import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { summarizeExposAreas, type LedgerAreaRow, type QuickQuoteAreaSummary } from './quickQuoteBuildingArea.js';

const DAILY_CAP = 300;
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
const JUSO_SEARCH = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
const JUSO_DETAIL = 'https://business.juso.go.kr/addrlink/addrDetailApi.do';
const LEDGER_AREA = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposPubuseAreaInfo';
const LEDGER_TITLE = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

export type QuickQuoteAddressHit = {
  road: string;
  jibun: string;
  building: string;
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
  lnbrMnnm: string;
  lnbrSlno: string;
  mtYn: string;
};

export type QuickQuoteUnit = { floor: string; ho: string };

export type QuickQuoteAreasResult =
  | QuickQuoteAreaSummary
  | { kind: 'building'; totalSqm: number; note: string };

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

async function juso(url: string, keyName: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
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
  const results = (body as { results?: { common?: { errorCode?: string }; juso?: unknown } }).results;
  if (String(results?.common?.errorCode ?? '') !== '0') throw new Error('LOOKUP_FAILED');
  return asRows(results?.juso);
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

export async function searchQuickQuoteAddress(tenantId: string, keyword: string): Promise<QuickQuoteAddressHit[]> {
  const q = keyword.trim();
  const key = cacheKey({ kind: 'address', q });
  return cached(tenantId, key, async () => {
    const rows = await juso(JUSO_SEARCH, 'JUSO_SEARCH_KEY', {
      currentPage: '1',
      countPerPage: '10',
      keyword: q,
    });
    return rows
      .map((row) => ({
        road: text(row, ['roadAddr']),
        jibun: text(row, ['jibunAddr']),
        building: text(row, ['bdNm']),
        admCd: text(row, ['admCd']),
        rnMgtSn: text(row, ['rnMgtSn']),
        udrtYn: text(row, ['udrtYn']) || '0',
        buldMnnm: text(row, ['buldMnnm']),
        buldSlno: text(row, ['buldSlno']) || '0',
        lnbrMnnm: text(row, ['lnbrMnnm']),
        lnbrSlno: text(row, ['lnbrSlno']) || '0',
        mtYn: text(row, ['mtYn']) || '0',
      }))
      .filter((row) => row.admCd && row.rnMgtSn && row.road);
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

export async function lookupQuickQuoteAreas(
  tenantId: string,
  plat: PlatKeys,
  dongNm?: string,
  hoNm?: string,
): Promise<QuickQuoteAreasResult> {
  const dong = dongNm?.trim() ?? '';
  const ho = hoNm?.trim() ?? '';
  const key = cacheKey({ kind: 'areas2', ...plat, dong, ho });
  return cached(tenantId, key, async () => {
    const rows = await fetchLedgerRows(plat, dong, ho);
    const summary = summarizeExposAreas(rows, dong || ho ? { dongNm: dong, hoNm: ho } : undefined);
    if (summary.kind !== 'empty') return summary;
    if (dong || ho) return { kind: 'empty' as const };
    const totalSqm = await fetchTitleSqm(plat);
    if (totalSqm == null) return { kind: 'empty' as const };
    return {
      kind: 'building' as const,
      totalSqm,
      note: '이 주소는 집별 면적이 없어 건물 전체 면적만 보여 드려요.',
    };
  });
}
