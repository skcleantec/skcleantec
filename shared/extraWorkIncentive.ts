/** 추가 시공 인센티브. 회사+팀장+마케터 = 10000(100%). 오버라이딩은 그 안에서 뗀다. */

export const EXTRA_WORK_BPS_TOTAL = 10_000;

export const EXTRA_WORK_AREA_LABELS = ['방', '발코니', '화장실', '주방', '거실'] as const;

export const EXTRA_WORK_DEFAULT_PRESETS = ['곰팡이', '줄눈', '오염', '실리콘'] as const;

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
