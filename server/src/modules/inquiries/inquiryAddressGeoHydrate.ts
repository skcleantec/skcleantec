import type { PrismaClient } from '@prisma/client';
import { getKakaoRestApiKey, kakaoGeocodeSequential } from '../geocode/kakaoGeocodeClient.js';
import { inquiryGeocodeQueryLine } from './inquiryAddressGeoSync.js';

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
  if (opts?.maxUniqueQueries === 0) return [];

  const maxQ = Math.min(35, Math.max(1, opts?.maxUniqueQueries ?? 18));
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
