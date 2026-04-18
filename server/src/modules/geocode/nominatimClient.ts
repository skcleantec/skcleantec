/**
 * OpenStreetMap Nominatim (공개 지오코딩).
 * 이용 정책: 초당 1회 이하, User-Agent 식별 필수.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

export type NominatimHit = { lat: number; lon: number; displayName: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatimSearchOnce(
  addressLine: string,
  opts: { countryCodes?: string }
): Promise<NominatimHit | null> {
  const q = addressLine.trim();
  if (!q) return null;

  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  if (opts.countryCodes) url.searchParams.set('countrycodes', opts.countryCodes);
  url.searchParams.set('accept-language', 'ko');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 14_000);

  const res = await fetch(url.toString(), {
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SKCleanTeck-AdminScheduleMap/1.0 (internal geocode; contact: support@skcleantec.local)',
    },
  });
  clearTimeout(t);

  if (!res.ok) {
    console.warn('[nominatim] HTTP', res.status, q.slice(0, 40));
    return null;
  }

  const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = data[0];
  if (!first?.lat || !first?.lon) return null;
  const lat = parseFloat(first.lat);
  const lon = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    displayName: typeof first.display_name === 'string' ? first.display_name : q,
  };
}

function stripParentheticalForNominatim(s: string): string {
  return s.replace(/\([^)]{0,80}\)/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function nominatimGeocodeOne(
  addressLine: string,
  opts?: { fast?: boolean }
): Promise<NominatimHit | null> {
  const fast = opts?.fast === true;
  const q = addressLine.trim();
  if (!q) return null;
  const withKr = await nominatimSearchOnce(q, { countryCodes: 'kr' });
  if (withKr) return withKr;
  /** 한글 도로명은 country 제한 없이 한 번 더 시도 (Nominatim 1초 정책 준수) */
  await sleep(1100);
  const globalHit = await nominatimSearchOnce(q, {});
  if (globalHit) return globalHit;
  if (fast) return null;
  const simplified = stripParentheticalForNominatim(q);
  if (!simplified || simplified === q) return null;
  await sleep(1100);
  const sKr = await nominatimSearchOnce(simplified, { countryCodes: 'kr' });
  if (sKr) return sKr;
  await sleep(1100);
  return nominatimSearchOnce(simplified, {});
}

/** 순차 호출(초당 1건 준수). 첫 요청 전에는 대기 없음. */
export async function nominatimGeocodeSequential(
  uniqueQueries: string[],
  opts?: { delayMs?: number; fastOne?: boolean }
): Promise<Map<string, NominatimHit | null>> {
  const delayMs = opts?.delayMs ?? 1100;
  const fastOne = opts?.fastOne === true;
  const out = new Map<string, NominatimHit | null>();
  let first = true;
  for (const query of uniqueQueries) {
    if (!first) await sleep(delayMs);
    first = false;
    try {
      const hit = await nominatimGeocodeOne(query, { fast: fastOne });
      out.set(query, hit);
    } catch (e) {
      console.warn('[nominatim] 실패:', query.slice(0, 48), e);
      out.set(query, null);
    }
  }
  return out;
}
