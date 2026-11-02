import type {
  TelecrmQuoteCrewLearningBackfillResult,
  TelecrmQuoteCrewLearningHints,
  TelecrmQuoteCrewLearningOverview,
  TelecrmPropertyChoiceOptions,
} from '@shared/telecrmQuoteCrewLearning';

const API = '/api/crm';

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchTelecrmQuoteCrewLearningOverview(
  token: string,
): Promise<TelecrmQuoteCrewLearningOverview> {
  const res = await fetch(`${API}/quote-learning/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmQuoteCrewLearningOverview>(res);
}

export async function fetchTelecrmQuoteCrewLearningHints(
  token: string,
  query: {
    pyeong?: string;
    propertyType?: string;
    buildingType?: string;
    isOneRoom?: boolean;
    roomCount?: string;
    bathroomCount?: string;
    balconyCount?: string;
  },
): Promise<TelecrmQuoteCrewLearningHints> {
  const params = new URLSearchParams();
  if (query.pyeong?.trim()) params.set('pyeong', query.pyeong.trim());
  if (query.propertyType?.trim()) params.set('propertyType', query.propertyType.trim());
  if (query.buildingType?.trim()) params.set('buildingType', query.buildingType.trim());
  if (query.isOneRoom) params.set('isOneRoom', 'true');
  if (query.roomCount?.trim()) params.set('roomCount', query.roomCount.trim());
  if (query.bathroomCount?.trim()) params.set('bathroomCount', query.bathroomCount.trim());
  if (query.balconyCount?.trim()) params.set('balconyCount', query.balconyCount.trim());
  const qs = params.toString();
  const res = await fetch(`${API}/quote-learning/hints${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmQuoteCrewLearningHints>(res);
}

export type TelecrmQuoteCrewLearningBackfillResponse = TelecrmQuoteCrewLearningBackfillResult & {
  overview: TelecrmQuoteCrewLearningOverview;
};

export async function backfillTelecrmQuoteCrewLearning(
  token: string,
  /** 비우면 전체 접수를 학습 (서버가 500건씩 나눠 처리) */
  limit?: number,
): Promise<TelecrmQuoteCrewLearningBackfillResponse> {
  const res = await fetch(`${API}/quote-learning/backfill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(limit != null ? { limit } : {}),
  });
  return parseJson<TelecrmQuoteCrewLearningBackfillResponse>(res);
}

/** 접수란 건축물 유형·건물 형태 선택지 — 손님 발주서와 같은 목록 */
export async function fetchTelecrmPropertyChoiceOptions(token: string): Promise<TelecrmPropertyChoiceOptions> {
  const res = await fetch(`${API}/quote-learning/property-options`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmPropertyChoiceOptions>(res);
}
