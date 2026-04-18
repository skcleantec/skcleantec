import type { PrismaClient } from '@prisma/client';
import { normalizeGeocodeQuery } from '../geocode/geocodeNormalize.js';
import { getKakaoRestApiKey, kakaoGeocodeOne } from '../geocode/kakaoGeocodeClient.js';
import { nominatimGeocodeOne } from '../geocode/nominatimClient.js';

/** 지도·배치 지오코딩과 동일: 도로명(`address`) 우선, 없으면 상세 포함 한 줄 */
export function inquiryGeocodeQueryLine(address: string, addressDetail: string | null | undefined): string {
  const road = (address ?? '').trim();
  if (road) return normalizeGeocodeQuery(road);
  const d = (addressDetail ?? '').trim();
  const full = d ? `${road} ${d}`.trim() : road;
  return normalizeGeocodeQuery(full);
}

/**
 * 접수 주소에 맞춰 좌표 캐시를 갱신한다.
 * - `addressGeoQuery`가 현재 지오코딩 입력과 같으면 외부 호출 없이 종료(성공·실패 모두 캐시).
 * - `force`: true면 위 캐시를 무시하고 다시 지오코딩(백필·키 추가 후 재시도용).
 * - 카카오 REST 키가 있으면 카카오만 사용, 없으면 Nominatim 1건(느릴 수 있음).
 */
export async function syncInquiryAddressGeo(
  prisma: PrismaClient,
  inquiryId: string,
  opts?: { force?: boolean }
): Promise<void> {
  const row = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      address: true,
      addressDetail: true,
      addressGeoLat: true,
      addressGeoLng: true,
      addressGeoQuery: true,
    },
  });
  if (!row) return;

  const q = inquiryGeocodeQueryLine(row.address, row.addressDetail);
  if (!q) {
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { addressGeoLat: null, addressGeoLng: null, addressGeoQuery: null },
    });
    return;
  }

  if (!opts?.force && row.addressGeoQuery === q) {
    return;
  }

  const kakaoKey = getKakaoRestApiKey();
  const hit = kakaoKey
    ? await kakaoGeocodeOne(q, kakaoKey)
    : await nominatimGeocodeOne(q, { fast: true });

  if (hit) {
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        addressGeoLat: hit.lat,
        addressGeoLng: hit.lon,
        addressGeoQuery: q,
      },
    });
  } else {
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        addressGeoLat: null,
        addressGeoLng: null,
        addressGeoQuery: q,
      },
    });
  }
}
