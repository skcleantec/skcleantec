/**
 * @generated-sync from shared/telecrmQuoteCrewLearning.ts — 서버 rootDir 한계로 동기 복사본.
 */

export type TelecrmQuoteCrewLearningReadiness = 'insufficient' | 'basic' | 'good' | 'strong';

export type TelecrmQuoteCrewLearningConfidence = 'none' | 'low' | 'medium' | 'high';

export type TelecrmQuoteCrewLearningStructureInput = {
  areaPyeong?: number | null;
  propertyType?: string | null;
  buildingType?: string | null;
  isOneRoom?: boolean;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
};

export type TelecrmQuoteCrewLearningCluster = {
  featureKey: string;
  label: string;
  count: number;
  medianAmountWon: number | null;
  medianTeamLeaderCount: number;
  medianCrewMemberCount: number | null;
};

export type TelecrmQuoteCrewLearningRecentRow = {
  id: string;
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string | null;
  featureLabel: string;
  areaPyeong: number | null;
  serviceTotalAmount: number | null;
  teamLeaderCount: number;
  crewMemberCount: number | null;
  updatedAt: string;
};

export type TelecrmQuoteCrewLearningOverview = {
  totalSnapshots: number;
  snapshotsLast7Days: number;
  snapshotsLast30Days: number;
  lastSnapshotAt: string | null;
  readiness: TelecrmQuoteCrewLearningReadiness;
  readinessLabel: string;
  readinessHint: string;
  topClusters: TelecrmQuoteCrewLearningCluster[];
  recent: TelecrmQuoteCrewLearningRecentRow[];
};

export type TelecrmQuoteCrewLearningExample = {
  date: string | null;
  customerName: string | null;
  inquiryNumber: string | null;
  pyeong: number | null;
  propertyLabel: string | null;
  buildingLabel: string | null;
  isOneRoom: boolean;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  amount: number | null;
};

export type TelecrmQuoteCrewLearningHints = {
  matchCount: number;
  confidence: TelecrmQuoteCrewLearningConfidence;
  featureLabel: string | null;
  medianAmountWon: number | null;
  /** 추천 견적가 — 유사 건 중앙값을 1만원 단위로 반올림 */
  recommendedAmount: number | null;
  amountRangeWon: { p25: number; p75: number } | null;
  typicalTeamLeaderCount: number | null;
  typicalCrewMemberCount: number | null;
  sampleInquiryNumbers: string[];
  /** 비교에 쓴 실제 접수 — 최신순 최대 5건 (날짜·이름·평수·구조·금액) */
  examples?: TelecrmQuoteCrewLearningExample[];
  /**
   * 어디까지 같은 예약으로 찾았는지 (평수는 항상 같음)
   * exact: 유형·건물 형태·방·화·베까지 / type: 유형·방·화 / structure: 방·화만(유형 다를 수 있음) / pyeong: 평수만
   */
  matchLevel?: TelecrmQuoteCrewMatchLevel;
  /** exact·type 이면 true — 구조·유형까지 맞춘 믿을 만한 추천 */
  matchLevelIsStrong?: boolean;
  /** 화면용 설명 (예: 「34평 · 아파트 · 방3·화2·베1까지 같은 예약」) — 선택지 코드는 절대 넣지 않음 */
  matchLabel?: string | null;
  /** AI 견적 — 과거 예약 전체로 배운 「우리 업체 표준 가격」 (1만원 단위 확정 금액). 배울 예약이 없으면 null */
  quote?: TelecrmAiQuote | null;
};

/** AI 견적 근거 한 줄 (예: 「24평 아파트 기본」 240,000 / 「화장실 2개」 +10,000) */
export type TelecrmAiQuotePart = { label: string; amountWon: number; /** 말로 넣은 규칙에서 나온 줄 */ rule?: boolean };

export type TelecrmAiQuote = {
  /** 확정 금액 — 1만원 단위 */
  amountWon: number;
  /** 금액이 어떻게 나왔는지 (기본 + 더하고 빼는 항목) */
  parts: TelecrmAiQuotePart[];
  /** 배운 예약 수 */
  sampleCount: number;
  /** 마지막으로 다시 배운 시각 */
  trainedAt: string;
  /** brand: 이 브랜드 예약으로 배움 / tenant: 업체 전체 예약으로 배움 */
  scope: 'brand' | 'tenant';
};

export type TelecrmQuoteCrewMatchLevel = 'exact' | 'type' | 'structure' | 'pyeong' | 'none';

/** 발주서와 같은 건축물 유형·건물 형태 선택지 (value 는 저장값, label 은 화면 글) */
export type TelecrmPropertyChoiceOption = { value: string; label: string };

export type TelecrmPropertyChoiceOptions = {
  propertyTypes: TelecrmPropertyChoiceOption[];
  buildingTypes: TelecrmPropertyChoiceOption[];
};

function squashChoiceText(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function stripChoiceParens(raw: string): string {
  return raw.replace(/\([^)]*\)/g, '');
}

/**
 * 숨고·미소 등에서 온 자유 글(예: 「아파트」)을 선택지 저장값으로 바꾼다.
 * 공백 무시 · 괄호 설명 무시 · 포함 관계(2글자 이상, 가장 긴 이름 우선). 못 찾으면 빈 문자.
 */
export function matchTelecrmChoiceByText(
  options: readonly TelecrmPropertyChoiceOption[] | null | undefined,
  raw: unknown,
): string {
  const text = squashChoiceText(raw);
  if (!text || !options?.length) return '';
  for (const o of options) {
    if (squashChoiceText(o.value) === text || squashChoiceText(o.label) === text) return o.value;
  }
  const bare = squashChoiceText(stripChoiceParens(String(raw ?? '')));
  for (const o of options) {
    if (bare && squashChoiceText(stripChoiceParens(o.label)) === bare) return o.value;
  }
  let best: { value: string; len: number } | null = null;
  for (const o of options) {
    const label = squashChoiceText(stripChoiceParens(o.label));
    if (label.length < 2) continue;
    const hit = text.includes(label) || (bare.length >= 2 && label.includes(bare));
    if (hit && (!best || label.length > best.len)) best = { value: o.value, len: label.length };
  }
  return best?.value ?? '';
}

export type TelecrmQuoteCrewLearningBackfillResult = {
  processed: number;
  upserted: number;
  removed: number;
  skipped: number;
};

function normToken(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toLowerCase();
  return t || '-';
}

export function bucketAreaPyeong(areaPyeong: number | null | undefined): string {
  if (areaPyeong == null || !Number.isFinite(areaPyeong) || areaPyeong <= 0) return '?';
  // 평수는 묶지 않고 1평 단위로 나눔 (20평과 21평은 다른 가격대) — 소수점은 반올림
  return String(Math.round(areaPyeong));
}

export function buildTelecrmQuoteCrewFeatureKey(input: TelecrmQuoteCrewLearningStructureInput): string {
  return [
    bucketAreaPyeong(input.areaPyeong ?? null),
    normToken(input.propertyType),
    normToken(input.buildingType),
    input.isOneRoom ? '1r' : '0r',
    input.roomCount ?? '-',
    input.bathroomCount ?? '-',
    input.balconyCount ?? '-',
  ].join('|');
}

export function buildTelecrmQuoteCrewFeatureLabel(input: TelecrmQuoteCrewLearningStructureInput): string {
  const parts: string[] = [];
  if (input.areaPyeong != null && Number.isFinite(input.areaPyeong) && input.areaPyeong > 0) {
    parts.push(`${input.areaPyeong}평`);
  }
  if (input.propertyType?.trim()) parts.push(input.propertyType.trim());
  if (input.buildingType?.trim()) parts.push(input.buildingType.trim());
  if (input.isOneRoom) {
    parts.push('원룸');
  } else {
    const rooms: string[] = [];
    if (input.roomCount != null) rooms.push(`${input.roomCount}룸`);
    if (input.bathroomCount != null) rooms.push(`${input.bathroomCount}욕`);
    if (input.balconyCount != null) rooms.push(`${input.balconyCount}베`);
    if (rooms.length > 0) parts.push(rooms.join('·'));
  }
  return parts.length > 0 ? parts.join(' ') : '구조 미입력';
}

export function resolveTelecrmQuoteCrewLearningReadiness(total: number): {
  readiness: TelecrmQuoteCrewLearningReadiness;
  label: string;
  hint: string;
} {
  if (total >= 100) {
    return {
      readiness: 'strong',
      label: '충분히 학습됨',
      hint: '유사 조건 견적·인원 힌트를 적극 활용할 수 있습니다.',
    };
  }
  if (total >= 30) {
    return {
      readiness: 'good',
      label: '학습 진행 중',
      hint: '예약확정 건이 쌓일수록 금액·인원 추천이 정확해집니다.',
    };
  }
  if (total >= 10) {
    return {
      readiness: 'basic',
      label: '초기 학습',
      hint: '참고용 힌트만 제공됩니다. 더 많은 예약확정 데이터가 필요합니다.',
    };
  }
  return {
    readiness: 'insufficient',
    label: '데이터 부족',
    hint: '예약확정 접수가 쌓이면 자동으로 학습됩니다. 아래 「전체 동기화」로 기존 건도 반영하세요.',
  };
}

export function resolveTelecrmQuoteCrewLearningConfidence(matchCount: number): TelecrmQuoteCrewLearningConfidence {
  if (matchCount >= 15) return 'high';
  if (matchCount >= 5) return 'medium';
  if (matchCount >= 1) return 'low';
  return 'none';
}

export function medianInt(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  if (a == null || b == null) return null;
  return Math.round((a + b) / 2);
}

export function percentileInt(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx] ?? null;
}

/** AI 견적 규칙 조건 — 비어 있는 칸은 「상관없음」 */
export type TelecrmAiQuoteRuleCondition = {
  pyeongMin?: number | null;
  pyeongMax?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  isOneRoom?: boolean | null;
  /** 건물 유형 화면 이름 (아파트·오피스텔·빌라(연립) 등) */
  propertyType?: string | null;
};

/** min: 이 금액보다 낮으면 올림 / max: 높으면 내림 / add: 더하기(빼기는 음수) / set: 이 금액으로 / perPyeong: 평수 × 금액 */
export type TelecrmAiQuoteRuleActionKind = 'min' | 'max' | 'add' | 'set' | 'perPyeong';

export type TelecrmAiQuoteRuleSpec = {
  condition: TelecrmAiQuoteRuleCondition;
  action: { kind: TelecrmAiQuoteRuleActionKind; amountWon: number };
  /** 화면용 짧은 이름 (예: 「방3·화2 최소 25만원」) */
  summary: string;
};

export type TelecrmAiQuoteRuleDto = {
  id: string;
  text: string;
  spec: TelecrmAiQuoteRuleSpec;
  summary: string;
  isActive: boolean;
  sortOrder: number;
  createdByName: string | null;
  createdAt: string;
};

/** 규칙을 넣기 전·후 금액 비교 (AI가 제대로 배웠는지 보여 주기) */
export type TelecrmAiQuoteRuleExample = { label: string; beforeWon: number | null; afterWon: number | null };

export type TelecrmAiQuoteRuleParseResult =
  | {
      ok: true;
      spec: TelecrmAiQuoteRuleSpec;
      /** 「이렇게 이해했어요」 줄들 */
      understood: string[];
      examples: TelecrmAiQuoteRuleExample[];
    }
  | { ok: false; reason: string };

export type TelecrmAiQuoteModelStatus = {
  trainedAt: string | null;
  sampleCount: number;
  ruleCount: number;
  activeRuleCount: number;
};

/** AI 견적 가르치기 대화 한 줄 */
export type TelecrmAiQuoteChatMessage = { role: 'user' | 'ai'; text: string };

/** AI가 바꾼 규칙 하나 + 이해한 내용 + 넣기 전·후 금액 */
export type TelecrmAiQuoteRuleDraft = {
  spec: TelecrmAiQuoteRuleSpec;
  understood: string[];
  examples: TelecrmAiQuoteRuleExample[];
};

/**
 * AI 답 — ask: 되묻기(고를 수 있는 답 포함) / rules: 규칙으로 바꿈(여러 개 가능) / unsupported: 못 하는 이유
 */
export type TelecrmAiQuoteChatReply =
  | { type: 'ask'; reply: string; choices: string[] }
  | { type: 'rules'; reply: string; rules: TelecrmAiQuoteRuleDraft[] }
  | { type: 'unsupported'; reply: string };
