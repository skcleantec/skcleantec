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

export type QuickPasteLearnedRule = {
  fieldKey: string;
  pattern: string;
  created: boolean;
};

export type QuickPasteLearnedRuleDetail = QuickPasteLearnedRule & {
  id: string;
  ruleType: string;
  hitCount: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type QuickPasteLearningLogSummary = {
  id: string;
  inquiryId: string | null;
  textHash: string;
  textLength: number;
  missingAfterRule: string[];
  aiApplied: boolean;
  aiFilledFields: string[];
  userEditedFields: string[];
  createdAt: string;
};

export type QuickPasteParseSnapshot = {
  ruleDraft: QuickPasteDraft;
  previewDraft: QuickPasteDraft;
  aiApplied: boolean;
  aiFilledFields: string[];
};

export type QuickPasteEvidenceSource = 'rule' | 'tenant_rule' | 'ai' | 'user';

export type QuickPasteFieldEvidence = {
  snippet: string | null;
  source: QuickPasteEvidenceSource;
};

export type QuickPasteFieldEvidenceMap = Partial<
  Record<QuickPasteFieldKey | QuickPasteOptionalFieldKey | 'preferredTime', QuickPasteFieldEvidence>
>;

export type QuickPasteCorrection = {
  fieldKey: string;
  wrongValue: string | null;
  correctValue: string;
  snippet?: string | null;
};

export type QuickPasteParseResponse = {
  draft: QuickPasteDraft;
  ruleDraft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  missingAfterRule?: QuickPasteFieldKey[];
  fieldLabels: Record<QuickPasteFieldKey, string>;
  optionalFieldLabels: Record<QuickPasteOptionalFieldKey, string>;
  optionalAiHints: QuickPasteOptionalFieldKey[];
  duplicateMatches: QuickPasteDuplicateMatch[];
  soloAutoAssign: QuickPasteSoloAssignPreview | null;
  tenantRulesApplied: number;
  aiApplied: boolean;
  aiAvailable: boolean;
  aiFilledFields: string[];
  aiReviewed: boolean;
  aiCorrectedFields: string[];
  aiWarnings: string[];
  /** AI가 원문 전체를 읽고 요약한 문맥 */
  aiContextSummary?: string | null;
  fieldEvidence?: QuickPasteFieldEvidenceMap;
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
  parseSnapshot?: QuickPasteParseSnapshot,
  corrections?: QuickPasteCorrection[],
): Promise<{
  inquiry: { id: string; customerName: string; preferredDate?: string | null };
  soloAutoAssign: QuickPasteSoloAssignPreview | null;
  duplicateMatches: QuickPasteDuplicateMatch[];
  aiApplied?: boolean;
  userEditedFields?: string[];
  learnedRules?: QuickPasteLearnedRule[];
  correctionsLearned?: number;
}> {
  const res = await fetch(`${API}/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rawText, draft, parseSnapshot, corrections }),
  });
  return parseJson(res);
}

export type QuickPasteClarifyAskResponse = {
  fieldKey: QuickPasteFieldKey;
  fieldLabel: string;
  question: string;
  snippet: string | null;
  sourceLabel: string | null;
  aiAvailable: boolean;
};

export type QuickPasteClarifyRespondResponse = {
  fieldKey: QuickPasteFieldKey;
  confirmation: string;
  learnedLabel: string | null;
  value: string | number | null;
  draft: QuickPasteDraft;
  learnedRule: (QuickPasteLearnedRule & { id: string }) | null;
};

export async function askQuickPasteClarify(
  token: string,
  rawText: string,
  draft: QuickPasteDraft,
  fieldKey: QuickPasteFieldKey,
): Promise<QuickPasteClarifyAskResponse> {
  const res = await fetch(`${API}/clarify/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rawText, draft, fieldKey }),
  });
  return parseJson(res);
}

export async function respondQuickPasteClarify(
  token: string,
  body: {
    rawText: string;
    draft: QuickPasteDraft;
    fieldKey: QuickPasteFieldKey;
    userAnswer: string;
    snippet?: string | null;
    sourceLabel?: string | null;
  },
): Promise<QuickPasteClarifyRespondResponse> {
  const res = await fetch(`${API}/clarify/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function fetchQuickPasteLearnedRules(
  token: string,
  opts?: { limit?: number; source?: string },
): Promise<{ rules: QuickPasteLearnedRuleDetail[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.source) params.set('source', opts.source);
  const qs = params.toString();
  const res = await fetch(`${API}/learning/rules${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(res);
}

export async function fetchQuickPasteLearningLogs(
  token: string,
  opts?: { limit?: number },
): Promise<{ logs: QuickPasteLearningLogSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`${API}/learning/logs${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson(res);
}
