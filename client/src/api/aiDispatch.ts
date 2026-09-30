import { API } from './apiPrefix';
import type { AiDispatchFatigueBand, AiDispatchSlot } from '@shared/aiDispatch';
import type { TeamLeaderSizePolicyId } from '@shared/teamLeaderDispatch';

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export type AiDispatchLeader = {
  id: string;
  name: string;
  jobsPerDay: number;
  sizePolicy: TeamLeaderSizePolicyId;
  homeAddress: string;
  homeAddressDetail: string;
  homeLat: number;
  homeLng: number;
  band: AiDispatchFatigueBand;
  fatigue: number;
  note: string;
  usedJobs: number;
  remainingJobs: number;
  detail: {
    windowDays: number;
    workedDays: number;
    jobCount: number;
    restDays: number;
    sinceRest: boolean;
    normalWorkDays: number;
    normalJobs: number;
    loopKm: number | null;
    teamLoopKm: number | null;
    betweenDeltaKm: number | null;
    distanceSinceRestKm: number | null;
    largeJobs: number;
    soloJobs: number;
  };
};

export type AiDispatchManualJob = {
  id: string;
  customerName: string;
  areaLabel: string;
  pyeong: number | null;
  slot: AiDispatchSlot;
  teamLeaderId: string;
  teamLeaderName: string;
};

export type AiDispatchJob = {
  id: string;
  customerName: string;
  areaLabel: string;
  pyeong: number | null;
  isOneRoom: boolean;
  tone: 'GOOD' | 'NORMAL' | 'BAD' | 'SEVERE' | 'ELDERLY';
  lat: number | null;
  lng: number | null;
  slot: AiDispatchSlot;
  requiredLeaders: number;
  preferredTime: string | null;
  blockedReason: string | null;
};

export type AiDispatchProposal = {
  id: string;
  inquiryId: string;
  customerName: string;
  teamLeaderId: string | null;
  teamLeaderName: string | null;
  slot: string;
  reason: string;
  status: 'DRAFT' | 'APPROVED' | 'SKIPPED' | 'STALE';
  fromHomeKm: number | null;
};

export type AiDispatchBoard = {
  date: string;
  aiConfigured: boolean;
  settings: {
    extraLeaderMinPyeong: number;
    extraLeaderCount: number;
    twoRoomMaxPyeong: number;
    includeCrewInFatigue: boolean;
    normalWorkDaysPerWeek: number;
    normalJobsPerWeek: number;
  };
  leaders: AiDispatchLeader[];
  jobs: AiDispatchJob[];
  manualJobs: AiDispatchManualJob[];
  run: {
    id: string;
    status: string;
    summary: string | null;
    createdAt: string;
    loops: string[];
    proposals: AiDispatchProposal[];
  } | null;
};

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return data?.error || data?.message || '요청에 실패했습니다.';
}

export async function getAiDispatchBoard(token: string, date: string): Promise<AiDispatchBoard> {
  const res = await fetch(`${API}/ai-dispatch/board?date=${encodeURIComponent(date)}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<AiDispatchBoard>;
}

export async function runAiDispatch(token: string, date: string): Promise<{ aiConfigured: boolean; message?: string }> {
  const res = await fetch(`${API}/ai-dispatch/runs`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ aiConfigured: boolean; message?: string }>;
}

export async function patchAiDispatchProposal(
  token: string,
  id: string,
  body: { teamLeaderId: string | null },
): Promise<void> {
  const res = await fetch(`${API}/ai-dispatch/proposals/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function approveAiDispatch(
  token: string,
  proposalIds: string[],
): Promise<{ approvedInquiryIds: string[]; failed: Array<{ inquiryId: string; error: string }> }> {
  const res = await fetch(`${API}/ai-dispatch/approve`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ proposalIds }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ approvedInquiryIds: string[]; failed: Array<{ inquiryId: string; error: string }> }>;
}

export async function getAiDispatchProgress(
  token: string,
  date: string,
): Promise<{ step: number; message: string }> {
  const res = await fetch(`${API}/ai-dispatch/progress?date=${encodeURIComponent(date)}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ step: number; message: string }>;
}

export async function saveAiDispatchLeader(
  token: string,
  userId: string,
  body: { homeAddress: string; homeAddressDetail: string; jobsPerDay: number; sizePolicy: string },
): Promise<void> {
  const res = await fetch(`${API}/ai-dispatch/leaders/${userId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function saveAiDispatchSettings(
  token: string,
  body: {
    extraLeaderMinPyeong: number;
    extraLeaderCount: number;
    twoRoomMaxPyeong: number;
    includeCrewInFatigue: boolean;
    normalWorkDaysPerWeek: number;
    normalJobsPerWeek: number;
  },
): Promise<void> {
  const res = await fetch(`${API}/ai-dispatch/settings`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
}
