const API = '/api';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export type GeocodeBatchResultRow = {
  query: string;
  lat: number | null;
  lon: number | null;
  displayName?: string;
};

export type GeocodeBatchMeta = {
  kakaoApiConfigured: boolean;
  googleGeocodingConfigured?: boolean;
};

export type GeocodeBatchResponse = {
  results: GeocodeBatchResultRow[];
  meta?: GeocodeBatchMeta;
};

export async function geocodeAddressBatch(
  token: string,
  queries: string[]
): Promise<GeocodeBatchResponse> {
  const res = await fetch(`${API}/geocode/batch`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '주소 위치를 찾지 못했습니다.');
  }
  const data = (await res.json()) as {
    results?: GeocodeBatchResultRow[];
    meta?: GeocodeBatchMeta;
  };
  return {
    results: Array.isArray(data.results) ? data.results : [],
    meta: data.meta,
  };
}
