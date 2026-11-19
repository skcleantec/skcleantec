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

async function getJson(url: URL): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
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
    return await getJson(target);
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

async function fetchLedgerRows(plat: PlatKeys, dongNm: string, hoNm: string): Promise<LedgerAreaRow[]> {
  const base = {
    sigunguCd: plat.admCd.slice(0, 5),
    bjdongCd: plat.admCd.slice(5, 10),
    platGbCd: plat.mtYn === '1' ? '1' : '0',
    bun: pad4(plat.lnbrMnnm),
    ji: pad4(plat.lnbrSlno),
    numOfRows: '100',
    ...(dongNm ? { dongNm } : {}),
    ...(hoNm ? { hoNm } : {}),
  };
  const rows: LedgerAreaRow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const body = await ledger(LEDGER_AREA, { ...base, pageNo: String(page) });
    if (!ledgerOk(body)) throw new Error('LOOKUP_FAILED');
    const items = ledgerItems(body);
    for (const item of items) {
      rows.push({
        exposPubuseGbCd: text(item, ['exposPubuseGbCd']),
        area: text(item, ['area']),
        dongNm: text(item, ['dongNm']),
        hoNm: text(item, ['hoNm']),
        flrGbCd: text(item, ['flrGbCd']),
        flrNo: text(item, ['flrNo']),
        mainPurpsCdNm: text(item, ['mainPurpsCdNm']),
        etcPurps: text(item, ['etcPurps']),
      });
    }
    const total = Number((body as { response?: { body?: { totalCount?: string } } }).response?.body?.totalCount ?? 0);
    if (!items.length || rows.length >= total || items.length < 100) break;
  }
  return rows;
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
  const key = cacheKey({ kind: 'areas', ...plat, dong, ho });
  return cached(tenantId, key, async () => {
    const rows = await fetchLedgerRows(plat, dong, ho);
    const summary = summarizeExposAreas(rows, dong || ho ? { dongNm: dong, hoNm: ho } : undefined);
    if (summary.kind !== 'empty') return summary;
    const totalSqm = await fetchTitleSqm(plat);
    if (totalSqm == null) return { kind: 'empty' as const };
    return {
      kind: 'building' as const,
      totalSqm,
      note: '이 주소는 집별 면적이 없어 건물 전체 면적만 보여 드려요.',
    };
  });
}
