import { API, apiErrorMessage } from './apiPrefix';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformSignupTrialEvent = {
  id: string;
  name: string;
  isActive: boolean;
  trialDays: number;
  startsAt: string | null;
  endsAt: string | null;
  applySelfServe: boolean;
  applyPlatformProvision: boolean;
  includeCoinGrace: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  isCurrentlyEffective: boolean;
};

export type PlatformSignupTrialEventList = {
  items: PlatformSignupTrialEvent[];
  activeEventId: string | null;
  policyNote: string;
};

export type UpsertPlatformSignupTrialEventBody = {
  name: string;
  isActive?: boolean;
  trialDays?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  applySelfServe?: boolean;
  applyPlatformProvision?: boolean;
  includeCoinGrace?: boolean;
  priority?: number;
};

export async function listPlatformSignupTrialEvents(
  token: string,
): Promise<PlatformSignupTrialEventList> {
  const res = await fetch(`${API}/platform/signup-trial-events`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '이벤트 목록 조회 실패'));
  return res.json() as Promise<PlatformSignupTrialEventList>;
}

export async function createPlatformSignupTrialEvent(
  token: string,
  body: UpsertPlatformSignupTrialEventBody,
): Promise<PlatformSignupTrialEvent> {
  const res = await fetch(`${API}/platform/signup-trial-events`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '이벤트 생성 실패'));
  return res.json() as Promise<PlatformSignupTrialEvent>;
}

export async function updatePlatformSignupTrialEvent(
  token: string,
  id: string,
  body: Partial<UpsertPlatformSignupTrialEventBody>,
): Promise<PlatformSignupTrialEvent> {
  const res = await fetch(`${API}/platform/signup-trial-events/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '이벤트 저장 실패'));
  return res.json() as Promise<PlatformSignupTrialEvent>;
}

export async function deletePlatformSignupTrialEvent(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/platform/signup-trial-events/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '이벤트 삭제 실패'));
}
