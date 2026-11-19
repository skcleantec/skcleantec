/** 건축물대장 전유·공용 면적을 주거 평형으로 묶는다. 1평 = 3.305785㎡. */

const SQM_PER_PYEONG = 3.305785;
const CLUSTER_SQM = 0.5;
const SUPPLY_RATIO_MIN = 1;
const SUPPLY_RATIO_MAX = 1.6;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toPyeong(sqm: number): number {
  return round1(sqm / SQM_PER_PYEONG);
}

function format1(n: number): string {
  const rounded = round1(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
  supplySqm: number | null;
  supplyPyeong: number | null;
  households: number;
  /** 전용 대비 공급이 1.0~1.6 밖이라 공급 숫자를 비운 평형 */
  supplyUnconfirmed: boolean;
};

export type QuickQuoteAreaSummary =
  | { kind: 'groups'; groups: QuickQuoteAreaGroup[] }
  | { kind: 'unit'; exclusiveSqm: number; supplySqm: number | null; supplyPyeong: number | null; supplyUnconfirmed: boolean }
  | { kind: 'empty' };

/** "제107동", "107동", "107", "A-1동", "3101호"를 같은 동·호로 본다. */
export function normUnit(raw: string | null | undefined): string {
  const compact = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/제/g, '')
    .replace(/동/g, '')
    .replace(/호/g, '')
    .replace(/층/g, '');
  return compact.replace(/^([a-z]*)0+(?=\d)/, '$1');
}

export const UNIT_MISS_NOTE = '이 호수는 공개자료에서 못 찾았어요. 단지 평형에서 골라 주세요';

function withSuffix(raw: string, suffix: string): string {
  const text = raw.replace(/\s+/g, '');
  if (!text) return '';
  return text.includes(suffix) ? text : `${text}${suffix}`;
}

export function formatQuickQuoteUnitLine(
  dong: string,
  ho: string,
  unit: { exclusiveSqm: number; supplyPyeong: number | null; supplyUnconfirmed?: boolean },
): string {
  const place = [withSuffix(dong, '동'), withSuffix(ho, '호')].filter(Boolean).join(' ');
  const supply =
    unit.supplyUnconfirmed || unit.supplyPyeong == null ? '확인 필요' : `${format1(unit.supplyPyeong)}평`;
  const body = `전용 ${format1(unit.exclusiveSqm)}㎡ · 공급 ${supply}`;
  return place ? `${place} · ${body}` : body;
}

function purposeText(row: LedgerAreaRow): string {
  return `${row.mainPurpsCdNm ?? ''} ${row.etcPurps ?? ''}`;
}

/** 전유 용도가 아파트·공동주택·오피스텔(주거)인 줄. 상가·근린생활·업무시설은 제외. */
function isResidentialExclusive(row: LedgerAreaRow): boolean {
  const text = purposeText(row);
  if (/상가|근린생활|업무시설|판매시설/.test(text)) return false;
  return /아파트|공동주택|오피스텔/.test(text);
}

/** 주차장·기계실·전기실·지하층·관리사무소 공용은 공급에 넣지 않는다. */
function isExcludedCommon(row: LedgerAreaRow): boolean {
  const text = purposeText(row);
  if (/주차|기계실|전기실|지하|관리사무소/.test(text)) return true;
  if (String(row.flrGbCd ?? '') === '10') return true;
  const flr = String(row.flrNo ?? '');
  if (/^B/i.test(flr) || flr.startsWith('-')) return true;
  const n = Number(flr);
  return Number.isFinite(n) && n < 0;
}

type UnitCalc = {
  exclusiveSqm: number;
  supplySqm: number;
  supplyPyeong: number;
  supplyOk: boolean;
};

function mode(values: number[]): number | null {
  if (!values.length) return null;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0]!;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function toGroup(units: UnitCalc[]): QuickQuoteAreaGroup {
  const exclusive = mode(units.map((unit) => unit.exclusiveSqm)) ?? units[0]!.exclusiveSqm;
  const ok = units.filter((unit) => unit.supplyOk);
  const supplyPyeong = mode(ok.map((unit) => unit.supplyPyeong));
  const supplySqm = mode(ok.map((unit) => unit.supplySqm));
  return {
    exclusiveSqm: exclusive,
    supplySqm,
    supplyPyeong,
    households: units.length,
    supplyUnconfirmed: supplyPyeong == null,
  };
}

export function formatQuickQuoteAreaLine(group: QuickQuoteAreaGroup): string {
  const supply =
    group.supplyUnconfirmed || group.supplyPyeong == null ? '확인 필요' : `${format1(group.supplyPyeong)}평`;
  return `전용 ${format1(group.exclusiveSqm)}㎡ · 공급 ${supply} · ${group.households}세대`;
}

export function summarizeExposAreas(
  rows: LedgerAreaRow[],
  filter?: { dongNm?: string; hoNm?: string },
): QuickQuoteAreaSummary {
  const wantDong = filter?.dongNm ? normUnit(filter.dongNm) : '';
  const wantHo = filter?.hoNm ? normUnit(filter.hoNm) : '';
  const buckets = new Map<string, { exclusive: number; common: number; residential: boolean }>();

  for (const row of rows) {
    const dong = normUnit(row.dongNm);
    const ho = normUnit(row.hoNm);
    if (wantDong && dong !== wantDong) continue;
    if (wantHo && ho !== wantHo) continue;
    const area = Number(row.area);
    if (!Number.isFinite(area) || area <= 0) continue;
    const gb = String(row.exposPubuseGbCd ?? '');
    const key = `${dong}|${ho}`;
    const bucket = buckets.get(key) ?? { exclusive: 0, common: 0, residential: false };
    if (gb === '1') {
      if (isResidentialExclusive(row)) {
        bucket.exclusive += area;
        bucket.residential = true;
      }
    } else if (gb === '2' && !isExcludedCommon(row)) {
      bucket.common += area;
    }
    buckets.set(key, bucket);
  }

  const units: UnitCalc[] = [];
  for (const bucket of buckets.values()) {
    if (!bucket.residential || bucket.exclusive <= 0) continue;
    const exclusiveSqm = round1(bucket.exclusive);
    const supplySqm = round1(bucket.exclusive + bucket.common);
    const ratio = supplySqm / exclusiveSqm;
    const supplyOk = ratio >= SUPPLY_RATIO_MIN && ratio <= SUPPLY_RATIO_MAX;
    units.push({
      exclusiveSqm,
      supplySqm,
      supplyPyeong: toPyeong(supplySqm),
      supplyOk,
    });
  }
  if (!units.length) return { kind: 'empty' };

  if (wantDong && wantHo) {
    const group = toGroup(units);
    return {
      kind: 'unit',
      exclusiveSqm: group.exclusiveSqm,
      supplySqm: group.supplySqm,
      supplyPyeong: group.supplyPyeong,
      supplyUnconfirmed: group.supplyUnconfirmed,
    };
  }

  units.sort((a, b) => a.exclusiveSqm - b.exclusiveSqm);
  const clusters: UnitCalc[][] = [];
  for (const unit of units) {
    const current = clusters[clusters.length - 1];
    const anchor = current?.[0];
    if (current && anchor && unit.exclusiveSqm - anchor.exclusiveSqm <= CLUSTER_SQM) current.push(unit);
    else clusters.push([unit]);
  }

  const groups = clusters
    .map((cluster) => toGroup(cluster))
    .sort((a, b) => a.exclusiveSqm - b.exclusiveSqm);
  return { kind: 'groups', groups };
}

export type PresentedExposAreas =
  | { kind: 'groups'; groups: QuickQuoteAreaGroup[]; note?: string }
  | {
      kind: 'unit';
      exclusiveSqm: number;
      supplySqm: number | null;
      supplyPyeong: number | null;
      supplyUnconfirmed: boolean;
      line: string;
    }
  | { kind: 'empty' };

/** 동·호는 원본 행에서 걸러 낸다. 그 집·동이 없으면 단지 전체 평형을 그대로 돌려준다. */
export function presentExposAreas(
  rows: LedgerAreaRow[],
  filter?: { dongNm?: string; hoNm?: string },
): PresentedExposAreas {
  const dong = filter?.dongNm?.trim() ?? '';
  const ho = filter?.hoNm?.trim() ?? '';
  const summary = summarizeExposAreas(rows, dong || ho ? { dongNm: dong, hoNm: ho } : undefined);
  if (summary.kind === 'unit') {
    return { ...summary, line: formatQuickQuoteUnitLine(dong, ho, summary) };
  }
  if (summary.kind === 'groups') return summary;
  if (!dong && !ho) return { kind: 'empty' };
  const all = summarizeExposAreas(rows);
  if (all.kind === 'groups') return { kind: 'groups', groups: all.groups, note: UNIT_MISS_NOTE };
  return { kind: 'empty' };
}
