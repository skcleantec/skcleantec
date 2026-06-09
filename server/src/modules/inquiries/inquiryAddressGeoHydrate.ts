import type { PrismaClient } from '@prisma/client';
import { getKakaoRestApiKey, kakaoGeocodeSequential } from '../geocode/kakaoGeocodeClient.js';
import { inquiryGeocodeQueryLine } from './inquiryAddressGeoSync.js';

/** 목록 API 백그라운드 카카오 지오 — 로컬(dev)은 기본 끔(원격 DB+외부 API 이중 지연). `LIST_GEO_HYDRATE_MAX` 로 조정 */
export function resolveListGeoHydrateMax(opts?: { maxUniqueQueries?: number }): number {
  if (opts?.maxUniqueQueries === 0) return 0;
  const raw = (process.env.LIST_GEO_HYDRATE_MAX ?? '').trim();
  if (raw !== '') {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  if (process.env.NODE_ENV !== 'production') return 0;
  return Math.min(35, Math.max(1, opts?.maxUniqueQueries ?? 18));
}

type ListInquiryRow = {
  id: string;
  address: string;
  addressDetail: string | null;
  addressGeoLat: number | null;
  addressGeoLng: number | null;
  addressGeoQuery: string | null;
};

/**
 * 목록 등에서 좌표 캐시가 비어 있는 접수를 일부만 카카오로 채운다.
 * (Nominatim은 초당 1건 제한이라 목록 API에서 호출하지 않음.)
 * @returns DB에 반영한 접수 id 목록
 */
export async function hydrateMissingGeoForInquiryListItems(
  prisma: PrismaClient,
  items: ListInquiryRow[],
  opts?: { maxUniqueQueries?: number }
): Promise<string[]> {
  const kakaoKey = getKakaoRestApiKey();
  if (!kakaoKey) return [];
  /** 0이면 목록·스케줄 등에서 카카오 호출·DB 갱신 생략(상세·별도 동기화에 맡김) */
  const maxQ = resolveListGeoHydrateMax(opts);
  if (maxQ === 0) return [];
  const queryToIds = new Map<string, string[]>();

  for (const it of items) {
    const q = inquiryGeocodeQueryLine(it.address, it.addressDetail);
    if (!q) continue;
    const needs =
      it.addressGeoLat == null ||
      it.addressGeoLng == null ||
      it.addressGeoQuery !== q;
    if (!needs) continue;
    const arr = queryToIds.get(q) ?? [];
    arr.push(it.id);
    queryToIds.set(q, arr);
    if (queryToIds.size >= maxQ) break;
  }

  const keys = [...queryToIds.keys()];
  if (keys.length === 0) return [];

  const hitMap = await kakaoGeocodeSequential(keys, kakaoKey);
  const touchedIds: string[] = [];
  const writes: Array<ReturnType<typeof prisma.inquiry.updateMany>> = [];

  for (const q of keys) {
    const hit = hitMap.get(q) ?? null;
    const ids = queryToIds.get(q) ?? [];
    if (ids.length === 0) continue;
    for (const id of ids) touchedIds.push(id);
    if (hit) {
      writes.push(
        prisma.inquiry.updateMany({
          where: { id: { in: ids } },
          data: { addressGeoLat: hit.lat, addressGeoLng: hit.lon, addressGeoQuery: q },
        })
      );
    } else {
      writes.push(
        prisma.inquiry.updateMany({
          where: { id: { in: ids } },
          data: { addressGeoLat: null, addressGeoLng: null, addressGeoQuery: q },
        })
      );
    }
  }

  if (writes.length > 0) {
    await prisma.$transaction(writes);
  }

  return [...new Set(touchedIds)];
}

/** 백그라운드 지오코딩 진행 중인 접수 id — 같은 건의 중복 동시 호출 방지 */
const inFlightGeoIds = new Set<string>();

/**
 * 목록 응답을 막지 않고 신규(미좌표) 접수만 백그라운드에서 카카오로 채운다.
 * - 이미 좌표가 캐시된 건은 건너뜀(다음 로드부터 즉시 표시)
 * - 진행 중인 id는 다시 호출하지 않음
 * 호출 즉시 반환하며, 결과는 `hydrateMissingGeoForInquiryListItems`가 DB에 저장.
 */
export function scheduleBackgroundGeoHydrate(
  prisma: PrismaClient,
  items: ListInquiryRow[],
  opts?: { maxUniqueQueries?: number }
): void {
  if (!getKakaoRestApiKey()) return;
  if (resolveListGeoHydrateMax(opts) === 0) return;

  const pending = items.filter((it) => {
    const q = inquiryGeocodeQueryLine(it.address, it.addressDetail);
    if (!q) return false;
    const needs =
      it.addressGeoLat == null || it.addressGeoLng == null || it.addressGeoQuery !== q;
    return needs && !inFlightGeoIds.has(it.id);
  });
  if (pending.length === 0) return;

  for (const it of pending) inFlightGeoIds.add(it.id);
  void hydrateMissingGeoForInquiryListItems(prisma, pending, opts)
    .catch((e) => console.warn('[geo-hydrate] background 실패:', e))
    .finally(() => {
      for (const it of pending) inFlightGeoIds.delete(it.id);
    });
}

/** hydrate 후 목록 행에 좌표 필드만 최신으로 합친다 */
export async function mergeRefreshedInquiryGeoFields<T extends ListInquiryRow>(
  prisma: PrismaClient,
  rows: T[],
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return rows;
  const snap = await prisma.inquiry.findMany({
    where: { id: { in: ids } },
    select: { id: true, addressGeoLat: true, addressGeoLng: true, addressGeoQuery: true },
  });
  const m = new Map(snap.map((s) => [s.id, s]));
  return rows.map((row) => {
    const s = m.get(row.id);
    if (!s) return row;
    return {
      ...row,
      addressGeoLat: s.addressGeoLat,
      addressGeoLng: s.addressGeoLng,
      addressGeoQuery: s.addressGeoQuery,
    };
  });
}
