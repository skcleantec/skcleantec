/** 건축물대장 전유·공용 면적을 집별로 모아 전용·공급으로 바꾼다. 1평 = 3.305785㎡. */

const SQM_PER_PYEONG = 3.305785;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toPyeong(sqm: number): number {
  return round1(sqm / SQM_PER_PYEONG);
}

export type LedgerAreaRow = {
  exposPubuseGbCd?: string | null;
  area?: string | number | null;
  dongNm?: string | null;
  hoNm?: string | null;
  flrGbCd?: string | null;
  flrNo?: string | number | null;
  mainPurpsCdNm?: string | null;
  etcPurps?: string | null;
};

export type QuickQuoteAreaGroup = {
  exclusiveSqm: number;
  supplySqm: number;
  supplyPyeong: number;
  households: number;
};

export type QuickQuoteAreaSummary =
  | { kind: 'groups'; groups: QuickQuoteAreaGroup[] }
  | { kind: 'unit'; exclusiveSqm: number; supplySqm: number; supplyPyeong: number }
  | { kind: 'empty' };

function normUnit(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .replace(/동$/, '')
    .replace(/호$/, '');
}

/** 주차장·기계실·지하·옥탑 공용은 공급(주거공용)에 넣지 않는다. */
function isExcludedCommon(row: LedgerAreaRow): boolean {
  const text = `${row.mainPurpsCdNm ?? ''} ${row.etcPurps ?? ''}`;
  if (/주차|기계|전기|지하|탱크|정화|보일러/.test(text)) return true;
  const flrGb = String(row.flrGbCd ?? '');
  if (flrGb === '10' || flrGb === '30') return true;
  const flr = String(row.flrNo ?? '');
  if (/^B/i.test(flr) || flr.startsWith('-')) return true;
  const n = Number(flr);
  return Number.isFinite(n) && n < 0;
}

export function summarizeExposAreas(
  rows: LedgerAreaRow[],
  filter?: { dongNm?: string; hoNm?: string },
): QuickQuoteAreaSummary {
  const wantDong = filter?.dongNm ? normUnit(filter.dongNm) : '';
  const wantHo = filter?.hoNm ? normUnit(filter.hoNm) : '';
  const units = new Map<string, { exclusive: number; common: number }>();

  for (const row of rows) {
    const dong = normUnit(row.dongNm);
    const ho = normUnit(row.hoNm);
    if (wantDong && dong !== wantDong) continue;
    if (wantHo && ho !== wantHo) continue;
    const area = Number(row.area);
    if (!Number.isFinite(area) || area <= 0) continue;
    const gb = String(row.exposPubuseGbCd ?? '');
    const key = `${dong}|${ho}`;
    const unit = units.get(key) ?? { exclusive: 0, common: 0 };
    if (gb === '1') unit.exclusive += area;
    else if (gb === '2' && !isExcludedCommon(row)) unit.common += area;
    units.set(key, unit);
  }

  const usable = [...units.values()].filter((unit) => unit.exclusive > 0);
  if (!usable.length) return { kind: 'empty' };

  if (wantDong && wantHo) {
    const unit = usable[0]!;
    const supply = unit.exclusive + unit.common;
    return {
      kind: 'unit',
      exclusiveSqm: round1(unit.exclusive),
      supplySqm: round1(supply),
      supplyPyeong: toPyeong(supply),
    };
  }

  const grouped = new Map<string, { exclusiveSqm: number; supplySum: number; households: number }>();
  for (const unit of usable) {
    const exclusiveSqm = round1(unit.exclusive);
    const key = exclusiveSqm.toFixed(1);
    const group = grouped.get(key) ?? { exclusiveSqm, supplySum: 0, households: 0 };
    group.supplySum += unit.exclusive + unit.common;
    group.households += 1;
    grouped.set(key, group);
  }

  const groups = [...grouped.values()]
    .map((group) => {
      const supplySqm = group.supplySum / group.households;
      return {
        exclusiveSqm: group.exclusiveSqm,
        supplySqm: round1(supplySqm),
        supplyPyeong: toPyeong(supplySqm),
        households: group.households,
      };
    })
    .sort((a, b) => b.households - a.households || b.exclusiveSqm - a.exclusiveSqm);

  return { kind: 'groups', groups };
}
