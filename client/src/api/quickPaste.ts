const API = '/api/quick-paste';

export type QuickPasteFieldKey =
  | 'customerName'
  | 'customerPhone'
  | 'address'
  | 'preferredDate'
  | 'serviceBalanceAmount'
  | 'areaPyeong';

export type QuickPasteOptionalFieldKey = 'roomCount' | 'bathroomCount' | 'balconyCount';

export type QuickPasteDraft = {
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  serviceBalanceAmount: number | null;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  isOneRoom: boolean;
};

export type QuickPasteDuplicateMatch = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  customerPhone: string;
  preferredDate: string | null;
  status: string;
};

export type QuickPasteSoloAssignPreview = {
  teamLeaderId: string;
  teamLeaderName: string;
};

export type QuickPasteParseResponse = {
  draft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  fieldLabels: Record<QuickPasteFieldKey, string>;
  optionalFieldLabels: Record<QuickPasteOptionalFieldKey, string>;
  optionalAiHints: QuickPasteOptionalFieldKey[];
  duplicateMatches: QuickPasteDuplicateMatch[];
  soloAutoAssign: QuickPasteSoloAssignPreview | null;
  specialNotes: string;
  coinCost: number;
  coins: {
    remaining: number | null;
    unlimited: boolean;
    allowance: number | null;
    spent: number;
    periodYm: string;
  };
};

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '요청에 실패했습니다.');
  }
  return data;
}

export async function parseQuickPaste(token: string, rawText: string): Promise<QuickPasteParseResponse> {
  const res = await fetch(`${API}/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rawText }),
  });
  return parseJson(res);
}

export async function commitQuickPaste(
  token: string,
  rawText: string,
  draft: Partial<QuickPasteDraft>,
): Promise<{
  inquiry: { id: string; customerName: string; preferredDate?: string | null };
  soloAutoAssign: QuickPasteSoloAssignPreview | null;
  duplicateMatches: QuickPasteDuplicateMatch[];
}> {
  const res = await fetch(`${API}/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rawText, draft }),
  });
  return parseJson(res);
}
