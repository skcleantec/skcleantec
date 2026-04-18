import { Router } from 'express';
import { authMiddleware, adminOrMarketer } from '../auth/auth.middleware.js';
import { normalizeGeocodeQuery } from './geocodeNormalize.js';
import { getKakaoRestApiKey, kakaoGeocodeSequential } from './kakaoGeocodeClient.js';
import { getGoogleGeocodingApiKey, googleGeocodeSequential } from './googleGeocodeClient.js';
import { nominatimGeocodeSequential } from './nominatimClient.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

const MAX_QUERIES = 35;

/**
 * POST /api/geocode/batch
 * body: { queries: string[] } — 중복 제거 전 최대 35문자열(빈 문자열 제외)
 * 응답: { results: { query, lat, lon, displayName? }[] } — 입력 순서와 동일한 길이
 */
router.post('/batch', async (req, res) => {
  const raw = (req.body as { queries?: unknown })?.queries;
  if (!Array.isArray(raw)) {
    res.status(400).json({ error: 'queries 배열이 필요합니다.' });
    return;
  }
  const trimmed = raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => normalizeGeocodeQuery(s))
    .filter((s) => s.length > 0);
  if (trimmed.length === 0) {
    res.status(400).json({ error: '유효한 주소 문자열이 없습니다.' });
    return;
  }
  if (trimmed.length > MAX_QUERIES) {
    res.status(400).json({ error: `한 번에 최대 ${MAX_QUERIES}건까지 지오코딩할 수 있습니다.` });
    return;
  }

  const seen = new Set<string>();
  const uniqueOrdered: string[] = [];
  for (const q of trimmed) {
    if (seen.has(q)) continue;
    seen.add(q);
    uniqueOrdered.push(q);
  }

  try {
    const hitMap = await nominatimGeocodeSequential(uniqueOrdered);
    const kakaoKey = getKakaoRestApiKey();
    if (kakaoKey) {
      const misses = uniqueOrdered.filter((q) => hitMap.get(q) == null);
      if (misses.length > 0) {
        const kakaoMap = await kakaoGeocodeSequential(misses, kakaoKey);
        for (const q of misses) {
          const h = kakaoMap.get(q);
          if (h) hitMap.set(q, h);
        }
      }
    }
    const googleKey = getGoogleGeocodingApiKey();
    if (googleKey) {
      const missesG = uniqueOrdered.filter((q) => hitMap.get(q) == null);
      if (missesG.length > 0) {
        const googleMap = await googleGeocodeSequential(missesG, googleKey);
        for (const q of missesG) {
          const h = googleMap.get(q);
          if (h) hitMap.set(q, h);
        }
      }
    }
    const results = trimmed.map((query) => {
      const hit = hitMap.get(query) ?? null;
      if (!hit) return { query, lat: null as number | null, lon: null as number | null };
      return {
        query,
        lat: hit.lat,
        lon: hit.lon,
        displayName: hit.displayName,
      };
    });
    res.json({
      results,
      meta: {
        kakaoApiConfigured: Boolean(kakaoKey),
        googleGeocodingConfigured: Boolean(googleKey),
      },
    });
  } catch (e) {
    console.error('[geocode/batch]', e);
    res.status(502).json({ error: '지오코딩 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
});

export default router;
