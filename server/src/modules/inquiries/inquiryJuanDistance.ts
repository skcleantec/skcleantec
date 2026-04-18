/**
 * 인천 미추홀구 주안(주안역 인근) 기준 직선거리(km).
 * 좌표는 공개 지도 기준 대표점으로 고정한다.
 */
export const JUAN_INCHEON_REF = { lat: 37.46495, lng: 126.68055 } as const;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** 두 지점 사이 구면 직선거리(km, 지구 반경 6371km) */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 주안 기준 직선거리(km), 소수 한 자리. 좌표 없으면 null */
export function distanceKmFromJuan(lat: number | null | undefined, lon: number | null | undefined): number | null {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const km = haversineKm(lat, lon, JUAN_INCHEON_REF.lat, JUAN_INCHEON_REF.lng);
  return Math.round(km * 10) / 10;
}

export function attachDistanceFromJuanForInquiry<
  T extends { addressGeoLat: number | null; addressGeoLng: number | null },
>(row: T): T & { distanceFromJuanKm: number | null } {
  return {
    ...row,
    distanceFromJuanKm: distanceKmFromJuan(row.addressGeoLat, row.addressGeoLng),
  };
}
