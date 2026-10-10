import { API } from './apiPrefix';

export type ExtraWorkOverrideSource = 'NONE' | 'COMPANY' | 'MARKETER';

export type ExtraWorkSettlementKind = 'NORMAL' | 'REFUND' | 'COMPANY_SUPPORT';

export type ExtraWorkItem = {
  id: string;
  inquiryId: string;
  occurredAt: string;
  amountWon: number;
  settlementKind: ExtraWorkSettlementKind;
  workLabel: string;
  areaLabel: string | null;
  companyWon: number;
  teamLeaderWon: number;
  marketerWon: number;
  parentWon: number;
  marketerId: string;
  marketerName: string;
  parentMarketerId: string | null;
  parentMarketerName: string | null;
  customerName: string;
  inquiryNumber: string | null;
  photoCount: number;
  photoNames: string[];
  lines: ExtraWorkLineItem[];
  leaderShares: { teamLeaderId: string; name: string; amountWon: number }[];
};

export type ExtraWorkLineItem = {
  workLabel: string;
  placeLabel: string | null;
  quantity: number | null;
  unitLabel: string | null;
  amountWon: number;
  unitPriceWon: number | null;
  photoNames: string[];
};

export type ExtraWorkMarketerSetting = {
  id: string;
  name: string;
  parentMarketerId: string | null;
  companyPercent: number | null;
  teamLeaderPercent: number | null;
  marketerPercent: number | null;
  overrideSource: ExtraWorkOverrideSource;
  overridePercent: number;
};

export type ExtraWorkSettings = {
  companyPercent: number;
  teamLeaderPercent: number;
  marketerPercent: number;
  presets: string[];
  allowTraining: boolean;
  marketers: ExtraWorkMarketerSetting[];
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error || '요청을 처리하지 못했습니다.';
}

export async function fetchExtraWorkFormOptions(token: string, inquiryId: string) {
  const res = await fetch(`${API}/extra-work/form-options?inquiryId=${encodeURIComponent(inquiryId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as {
    presets: string[];
    areas: string[];
    units: string[];
    marketers: { id: string; name: string }[];
    teamLeaders: { id: string; name: string }[];
    defaultMarketerId: string | null;
    canChooseMarketer: boolean;
  };
}

export async function fetchExtraWorkList(token: string, query: { month?: string; inquiryId?: string }) {
  const params = new URLSearchParams();
  if (query.month) params.set('month', query.month);
  if (query.inquiryId) params.set('inquiryId', query.inquiryId);
  const res = await fetch(`${API}/extra-work?${params.toString()}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { items: ExtraWorkItem[] }).items;
}

export async function createExtraWork(
  token: string,
  input: {
    inquiryId: string;
    marketerId?: string;
    lines: Array<{
      workLabel: string;
      placeLabel: string;
      quantity: number | null;
      unitLabel: string;
      amountWon: number;
      photos: File[];
    }>;
  },
) {
  const body = new FormData();
  body.set('inquiryId', input.inquiryId);
  if (input.marketerId) body.set('marketerId', input.marketerId);
  body.set(
    'lines',
    JSON.stringify(
      input.lines.map((line) => ({
        workLabel: line.workLabel,
        placeLabel: line.placeLabel,
        quantity: line.quantity,
        unitLabel: line.unitLabel,
        amountWon: line.amountWon,
      })),
    ),
  );
  input.lines.forEach((line, index) => {
    for (const photo of line.photos) body.append(`photos_${index}`, photo);
  });
  const res = await fetch(`${API}/extra-work`, { method: 'POST', headers: authHeaders(token), body });
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { item: ExtraWorkItem }).item;
}

export async function saveExtraWorkPresets(token: string, presets: string[]) {
  const res = await fetch(`${API}/extra-work/presets`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ presets }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { presets: string[] }).presets;
}

export async function fetchExtraWorkSettings(token: string) {
  const res = await fetch(`${API}/extra-work/settings`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ExtraWorkSettings;
}

export async function saveExtraWorkSettings(
  token: string,
  input: {
    companyPercent: number;
    teamLeaderPercent: number;
    marketerPercent: number;
    presets: string[];
    allowTraining: boolean;
  },
) {
  const res = await fetch(`${API}/extra-work/settings`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ExtraWorkSettings;
}

export async function saveExtraWorkMarketer(
  token: string,
  userId: string,
  input: {
    parentMarketerId: string | null;
    companyPercent: number | null;
    teamLeaderPercent: number | null;
    marketerPercent: number | null;
    overrideSource: ExtraWorkOverrideSource;
    overridePercent: number;
  },
) {
  const res = await fetch(`${API}/extra-work/marketers/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ExtraWorkSettings;
}

export async function searchExtraWorkInquiries(token: string, query: string) {
  const res = await fetch(`${API}/extra-work/inquiries?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (
    (await res.json()) as {
      items: Array<{ id: string; customerName: string; inquiryNumber: string | null; teamLeaders: Array<{ id: string; name: string }> }>;
    }
  ).items;
}

export async function saveExtraWorkAdjustment(
  token: string,
  input: {
    recordId?: string;
    inquiryId: string;
    marketerId: string;
    teamLeaderId: string | null;
    kind: ExtraWorkSettlementKind;
    amountWon: number;
    occurredOn: string;
    note: string;
  },
) {
  const res = await fetch(`${API}/extra-work/adjustments`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { item: ExtraWorkItem }).item;
}
