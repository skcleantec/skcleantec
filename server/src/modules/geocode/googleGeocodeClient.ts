/**
 * Google Geocoding API (주소 → 좌표). 서버 전용 키만 사용.
 * Cloud Console에서 Geocoding API 활성화 및 과금(무료 한도 있음) 필요.
 * @see https://developers.google.com/maps/documentation/geocoding/overview
 */

import type { NominatimHit } from './nominatimClient.js';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

export function getGoogleGeocodingApiKey(): string | null {
  const k =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_GEOCODING_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

export async function googleGeocodeOne(query: string, apiKey: string): Promise<NominatimHit | null> {
  const q = query.trim();
  if (!q) return null;

  const url = new URL(GEOCODE_BASE);
  url.searchParams.set('address', q);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('language', 'ko');
  url.searchParams.set('region', 'kr');
  url.searchParams.set('components', 'country:KR');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 14_000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn('[google geocode] HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as {
      status?: string;
      error_message?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };
    const st = data.status;
    if (st && st !== 'OK') {
      if (st !== 'ZERO_RESULTS') {
        console.warn('[google geocode]', st, data.error_message?.slice(0, 120));
      }
      return null;
    }
    const first = data.results?.[0];
    const loc = first?.geometry?.location;
    const lat = loc?.lat;
    const lng = loc?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    const displayName =
      typeof first?.formatted_address === 'string' ? first.formatted_address : q;
    return { lat, lon: lng, displayName };
  } catch (e) {
    console.warn('[google geocode] 요청 실패', e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function googleGeocodeSequential(
  queries: string[],
  apiKey: string,
  opts?: { delayMs?: number }
): Promise<Map<string, NominatimHit | null>> {
  const delayMs = opts?.delayMs ?? 55;
  const out = new Map<string, NominatimHit | null>();
  let first = true;
  for (const query of queries) {
    if (!first) await sleep(delayMs);
    first = false;
    try {
      out.set(query, await googleGeocodeOne(query, apiKey));
    } catch (e) {
      console.warn('[google geocode] 실패:', query.slice(0, 48), e);
      out.set(query, null);
    }
  }
  return out;
}
