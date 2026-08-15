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

export type TelecrmQuoteCrewLearningHints = {
  matchCount: number;
  confidence: TelecrmQuoteCrewLearningConfidence;
  featureLabel: string | null;
  medianAmountWon: number | null;
  amountRangeWon: { p25: number; p75: number } | null;
  typicalTeamLeaderCount: number | null;
  typicalCrewMemberCount: number | null;
  sampleInquiryNumbers: string[];
};

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
  return String(Math.round(areaPyeong / 5) * 5);
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
