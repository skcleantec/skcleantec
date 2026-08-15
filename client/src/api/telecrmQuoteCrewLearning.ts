import type {
  TelecrmQuoteCrewLearningBackfillResult,
  TelecrmQuoteCrewLearningHints,
  TelecrmQuoteCrewLearningOverview,
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
  limit = 500,
): Promise<TelecrmQuoteCrewLearningBackfillResponse> {
  const res = await fetch(`${API}/quote-learning/backfill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit }),
  });
  return parseJson<TelecrmQuoteCrewLearningBackfillResponse>(res);
}
