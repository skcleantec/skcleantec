/**
 * 카카오 로컬 API — 주소·키워드 검색(지오코딩 보조).
 * REST API 키는 서버 환경변수에만 두고 클라이언트에 노출하지 않는다.
 * @see https://developers.kakao.com/docs/latest/ko/local/dev-guide
 */

import type { NominatimHit } from './nominatimClient.js';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const KAKAO_ADDRESS = 'https://dapi.kakao.com/v2/local/search/address.json';
const KAKAO_KEYWORD = 'https://dapi.kakao.com/v2/local/search/keyword.json';

function parseKakaoDoc(doc: {
  x?: unknown;
  y?: unknown;
  address_name?: unknown;
  place_name?: unknown;
}): NominatimHit | null {
  const x = typeof doc.x === 'string' ? parseFloat(doc.x) : typeof doc.x === 'number' ? doc.x : NaN;
  const y = typeof doc.y === 'string' ? parseFloat(doc.y) : typeof doc.y === 'number' ? doc.y : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const name =
    typeof doc.address_name === 'string'
      ? doc.address_name
      : typeof doc.place_name === 'string'
        ? doc.place_name
        : `${y},${x}`;
  return { lat: y, lon: x, displayName: name };
}

async function fetchKakaoJson(
  url: URL,
  apiKey: string
): Promise<{ documents?: unknown[] } | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `KakaoAK ${apiKey}`,
      },
    });
    if (!res.ok) {
      console.warn('[kakao geocode] HTTP', res.status);
      return null;
    }
    return (await res.json()) as { documents?: unknown[] };
  } catch (e) {
    console.warn('[kakao geocode] 요청 실패', e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function getKakaoRestApiKey(): string | null {
  const k =
    process.env.KAKAO_REST_API_KEY?.trim() || process.env.KAKAO_MAP_REST_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

export async function kakaoGeocodeOne(query: string, apiKey: string): Promise<NominatimHit | null> {
  const q = query.trim();
  if (!q) return null;

  const addrUrl = new URL(KAKAO_ADDRESS);
  addrUrl.searchParams.set('query', q);
  addrUrl.searchParams.set('analyze_type', 'similar');
  const addrJson = await fetchKakaoJson(addrUrl, apiKey);
  const docsA = Array.isArray(addrJson?.documents) ? addrJson.documents : [];
  const firstA = docsA[0] as { x?: unknown; y?: unknown; address_name?: unknown; place_name?: unknown } | undefined;
  let hitA = firstA ? parseKakaoDoc(firstA) : null;
  if (!hitA) {
    await sleep(80);
    const addrExact = new URL(KAKAO_ADDRESS);
    addrExact.searchParams.set('query', q);
    addrExact.searchParams.set('analyze_type', 'exact');
    const addrJsonEx = await fetchKakaoJson(addrExact, apiKey);
    const docsEx = Array.isArray(addrJsonEx?.documents) ? addrJsonEx.documents : [];
    const firstEx = docsEx[0] as { x?: unknown; y?: unknown; address_name?: unknown; place_name?: unknown } | undefined;
    hitA = firstEx ? parseKakaoDoc(firstEx) : null;
  }
  if (hitA) return hitA;

  await sleep(80);

  const keyUrl = new URL(KAKAO_KEYWORD);
  keyUrl.searchParams.set('query', q);
  keyUrl.searchParams.set('size', '1');
  const keyJson = await fetchKakaoJson(keyUrl, apiKey);
  const docsK = Array.isArray(keyJson?.documents) ? keyJson.documents : [];
  const firstK = docsK[0] as { x?: unknown; y?: unknown; address_name?: unknown; place_name?: unknown } | undefined;
  if (!firstK) return null;
  return parseKakaoDoc(firstK);
}

/** Nominatim 실패 건만 순차 처리 */
export async function kakaoGeocodeSequential(
  queries: string[],
  apiKey: string,
  opts?: { delayMs?: number }
): Promise<Map<string, NominatimHit | null>> {
  /** 카카오 과호출 방지 — 너무 크면 20건 배치가 수 초 걸림 */
  const delayMs = opts?.delayMs ?? 90;
  const out = new Map<string, NominatimHit | null>();
  let first = true;
  for (const query of queries) {
    if (!first) await sleep(delayMs);
    first = false;
    try {
      out.set(query, await kakaoGeocodeOne(query, apiKey));
    } catch (e) {
      console.warn('[kakao geocode] 실패:', query.slice(0, 48), e);
      out.set(query, null);
    }
  }
  return out;
}
