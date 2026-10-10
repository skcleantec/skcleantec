/** shared/extraWorkIncentive.ts 와 같은 계산. 서버는 src 밖을 import 하지 않는다. */

export const EXTRA_WORK_BPS_TOTAL = 10_000;

export const EXTRA_WORK_AREA_LABELS = ['창틀', '방', '발코니', '화장실', '주방', '거실', '베란다'] as const;

export const EXTRA_WORK_UNIT_LABELS = ['장', '개', 'm', '평', '식'] as const;

export const EXTRA_WORK_DEFAULT_PRESETS = [
  '곰팡이',
  '줄눈',
  '오염',
  '실리콘',
  '컬비시공',
  '바닥돌돌이',
  '스티커제거',
  '분진청소',
  '새집증후군',
] as const;

/** 시공 종류는 이 목록만 저장한다. AI가 나중에 같은 이름으로 구분한다. */
export function normalizeExtraWorkPresets(raw: string[]): { presets: string[]; error: string | null } {
  const presets: string[] = [];
  for (const item of raw) {
    const label = item.replace(/[\u0000-\u001f]/g, '').trim().replace(/\s+/g, ' ');
    if (!label) continue;
    if (label.length > 40) return { presets: [], error: '시공 종류는 40자 안으로 적어 주세요.' };
    if (!presets.includes(label)) presets.push(label);
    if (presets.length > 30) return { presets: [], error: '시공 종류는 30개까지 둘 수 있습니다.' };
  }
  if (presets.length < 1) return { presets: [], error: '시공 종류는 하나 이상 남겨 주세요.' };
  return { presets, error: null };
}

/** 한 건에 고른 시공 종류. 목록에 있는 이름만, 목록 순서로 이어 붙인다. */
export function resolveCatalogWorkLabels(presets: string[], raw: string[]): { label: string | null; error: string | null } {
  const picked: string[] = [];
  for (const item of raw) {
    const exact = presets.find((preset) => preset === item.trim());
    if (!exact) return { label: null, error: '시공 종류는 목록에 있는 것만 저장됩니다.' };
    if (!picked.includes(exact)) picked.push(exact);
  }
  if (picked.length < 1) return { label: null, error: '시공 종류를 하나 이상 골라 주세요.' };
  const label = presets.filter((preset) => picked.includes(preset)).join(' · ');
  if (label.length > 200) return { label: null, error: '시공 종류를 조금 줄여 주세요.' };
  return { label, error: null };
}

export type ExtraWorkLineDraft = {
  workLabel: string;
  placeLabel: string | null;
  quantity: number | null;
  unitLabel: string | null;
  amountWon: number;
};

export function extraWorkUnitPriceWon(amountWon: number, quantity: number | null) {
  if (quantity == null || quantity < 1) return null;
  return Math.round(amountWon / quantity);
}

export function extraWorkLineSummary(line: ExtraWorkLineDraft) {
  const place = line.placeLabel ? ` ${line.placeLabel}` : '';
  const qty = line.quantity != null && line.unitLabel ? ` ${line.quantity}${line.unitLabel}` : '';
  return `${line.workLabel}${place}${qty}`;
}

/** 한 집의 시공 항목. 종류·위치·단위는 목록에 있는 값만 남긴다. */
export function normalizeExtraWorkLines(presets: string[], raw: ExtraWorkLineDraft[]): {
  lines: ExtraWorkLineDraft[];
  summary: string;
  totalWon: number;
  error: string | null;
} {
  const fail = (error: string) => ({ lines: [] as ExtraWorkLineDraft[], summary: '', totalWon: 0, error });
  if (raw.length < 1) return fail('시공을 하나 이상 넣어 주세요.');
  if (raw.length > 8) return fail('시공은 8개까지 넣을 수 있습니다.');
  const lines: ExtraWorkLineDraft[] = [];
  for (const item of raw) {
    const workLabel = presets.find((preset) => preset === item.workLabel.trim());
    if (!workLabel) return fail('시공 종류는 목록에 있는 것만 저장됩니다.');
    const place = item.placeLabel?.trim() || '';
    if (place && !(EXTRA_WORK_AREA_LABELS as readonly string[]).includes(place)) {
      return fail('위치는 목록에서 골라 주세요.');
    }
    const unit = item.unitLabel?.trim() || '';
    if (item.quantity != null) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) {
        return fail('수량은 1 이상 숫자로 적어 주세요.');
      }
      if (!(EXTRA_WORK_UNIT_LABELS as readonly string[]).includes(unit)) return fail('단위를 골라 주세요.');
    } else if (unit) {
      return fail('수량을 적어 주세요.');
    }
    if (!Number.isInteger(item.amountWon) || item.amountWon < 1) return fail('시공 금액을 1원 이상 적어 주세요.');
    lines.push({
      workLabel,
      placeLabel: place || null,
      quantity: item.quantity,
      unitLabel: item.quantity != null ? unit : null,
      amountWon: item.amountWon,
    });
  }
  const summary = lines.map(extraWorkLineSummary).join(' · ');
  if (summary.length > 500) return fail('시공 설명이 너무 깁니다. 시공을 나눠 주세요.');
  return { lines, summary, totalWon: lines.reduce((sum, line) => sum + line.amountWon, 0), error: null };
}

export type ExtraWorkOverrideSource = 'NONE' | 'COMPANY' | 'MARKETER';

export type ExtraWorkLeaderShare = {
  teamLeaderId: string;
  amountWon: number;
};

export type ExtraWorkSplitInput = {
  amountWon: number;
  companyBps: number;
  teamLeaderBps: number;
  marketerBps: number;
  overrideSource: ExtraWorkOverrideSource;
  overrideBps: number;
  hasParent: boolean;
  teamLeaderIds: string[];
};

export type ExtraWorkSplitResult = {
  companyWon: number;
  teamLeaderWon: number;
  marketerWon: number;
  parentWon: number;
  leaderShares: ExtraWorkLeaderShare[];
};

export function bpsFromPercent(percent: number): number | null {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return null;
  return percent * 100;
}

export function percentFromBps(bps: number): number {
  return Math.round(bps / 100);
}

export function ratesError(companyBps: number, teamLeaderBps: number, marketerBps: number): string | null {
  const rows = [companyBps, teamLeaderBps, marketerBps];
  if (rows.some((n) => !Number.isInteger(n) || n < 0 || n > EXTRA_WORK_BPS_TOTAL)) {
    return '비율은 0~100% 사이여야 합니다.';
  }
  if (companyBps + teamLeaderBps + marketerBps !== EXTRA_WORK_BPS_TOTAL) {
    return '회사, 팀장, 마케터 비율의 합은 100%여야 합니다.';
  }
  return null;
}

export function splitExtraWorkAmount(input: ExtraWorkSplitInput): ExtraWorkSplitResult {
  const amount = input.amountWon;
  const rateError = ratesError(input.companyBps, input.teamLeaderBps, input.marketerBps);
  if (!Number.isInteger(amount) || amount < 1 || rateError) {
    throw new Error(rateError ?? '추가 금액은 1원 이상이어야 합니다.');
  }
  const companyBase = Math.floor((amount * input.companyBps) / EXTRA_WORK_BPS_TOTAL);
  const leaderPool = Math.floor((amount * input.teamLeaderBps) / EXTRA_WORK_BPS_TOTAL);
  let marketerWon = amount - companyBase - leaderPool;
  let companyWon = companyBase;
  let parentWon = 0;
  const overrideBps = input.hasParent ? input.overrideBps : 0;
  if (
    input.hasParent &&
    input.overrideSource !== 'NONE' &&
    Number.isInteger(overrideBps) &&
    overrideBps > 0 &&
    overrideBps <= EXTRA_WORK_BPS_TOTAL
  ) {
    if (input.overrideSource === 'COMPANY') {
      parentWon = Math.floor((companyWon * overrideBps) / EXTRA_WORK_BPS_TOTAL);
      companyWon -= parentWon;
    } else {
      parentWon = Math.floor((marketerWon * overrideBps) / EXTRA_WORK_BPS_TOTAL);
      marketerWon -= parentWon;
    }
  }
  const leaderIds = [...new Set(input.teamLeaderIds.filter(Boolean))];
  if (leaderIds.length === 0) {
    return {
      companyWon: companyWon + leaderPool,
      teamLeaderWon: 0,
      marketerWon,
      parentWon,
      leaderShares: [],
    };
  }
  const base = Math.floor(leaderPool / leaderIds.length);
  const remainder = leaderPool - base * leaderIds.length;
  const leaderShares = leaderIds.map((teamLeaderId, index) => ({
    teamLeaderId,
    amountWon: base + (index === leaderIds.length - 1 ? remainder : 0),
  }));
  return {
    companyWon,
    teamLeaderWon: leaderPool,
    marketerWon,
    parentWon,
    leaderShares,
  };
}
