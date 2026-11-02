/**
 * 텔레CRM AI 견적 — 과거 예약 전체로 「우리 업체 표준 가격」을 배우고, 조건을 넣으면 1만원 단위 금액 하나로 답한다.
 *
 * 배우는 방법 (같은 데이터면 늘 같은 결과):
 *  1) 평수별 기본 금액 — 같은 평수 예약의 가운데 금액(최근 예약일수록 더 크게 반영).
 *     같은 평수 예약이 적으면 가까운 평수의 「평당 금액」으로 채우고, 평수가 클수록 금액이 줄지 않게 맞춤.
 *     기본 금액에서 너무 벗어난 예약(옵션·특수 작업 등으로 보이는 것)은 빼고 다시 계산.
 *  2) 기본 금액과 실제 금액의 차이로 건물 유형·화장실·방·베란다·원룸이 각각 얼마를 더하고 빼는지 계산.
 *     예약이 충분하고(20건 이상) 차이가 3천원 이상인 것만 반영.
 *  6시간마다 새 예약까지 넣어 다시 배움.
 */
import { prisma } from '../../lib/prisma.js';
import type { TelecrmAiQuote, TelecrmAiQuotePart } from '../../lib/telecrmQuoteCrewLearning.js';
import {
  loadTelecrmPropertyChoiceResolver,
  type TelecrmPropertyChoiceResolver,
} from './telecrmPropertyChoices.service.js';

const HALF_LIFE_DAYS = 180;
const MAX_AGE_DAYS = 3 * 365;
const MIN_BASE_ROWS = 8;
const MAX_WINDOW = 5;
const MIN_ADJ_ROWS = 20;
const MIN_ADJ_WON = 3000;
const OUTLIER_LOW = 0.72;
const OUTLIER_HIGH = 1.35;
const BRAND_MIN_ROWS = 300;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_P = 3;
const MAX_P = 150;

type TrainRow = {
  p: number;
  amount: number;
  w: number;
  typeKey: string | null;
  typeLabel: string | null;
  rooms: number | null;
  baths: number | null;
  balc: number | null;
  oneRoom: boolean;
};

type Typical = { rooms: number | null; baths: number | null; balc: number | null };

type Model = {
  trainedAt: Date;
  sampleCount: number;
  scope: 'brand' | 'tenant';
  base: Map<number, number>;
  minP: number;
  maxP: number;
  typical: Map<number, Typical>;
  typeAdj: Map<string, number>;
  typeLabels: Map<string, string>;
  bathAdj: Map<number, number>;
  roomAdj: Map<number, number>;
  balcAdj: Map<number, number>;
  oneRoomAdj: number;
  resolver: TelecrmPropertyChoiceResolver;
};

const cache = new Map<string, { at: number; promise: Promise<Model | null> }>();

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function weightedMedian(values: { v: number; w: number }[]): number | null {
  const list = values.filter((x) => Number.isFinite(x.v) && x.w > 0).sort((a, b) => a.v - b.v);
  if (list.length === 0) return null;
  const total = list.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of list) {
    acc += x.w;
    if (acc >= total / 2) return x.v;
  }
  return list[list.length - 1].v;
}

function weightedMode(values: { v: number; w: number }[]): number | null {
  const m = new Map<number, number>();
  for (const x of values) m.set(x.v, (m.get(x.v) ?? 0) + x.w);
  let best: number | null = null;
  let bestW = -1;
  for (const [v, w] of [...m.entries()].sort((a, b) => a[0] - b[0])) {
    if (w > bestW) {
      best = v;
      bestW = w;
    }
  }
  return best;
}

/**
 * 평수가 클수록 기본 금액이 줄지 않게 — 거꾸로 된 구간은 묶어서 그 구간의 가운데 금액(예약 수 기준)으로 맞춤.
 * 평균이 아니라 가운데 금액이라, 한 평수만 싸게 받은 경우 앞뒤 평수 금액이 같이 내려가지 않음.
 */
function monotoneNonDecreasing(points: { p: number; v: number; w: number }[]): Map<number, number> {
  type Block = { pts: { p: number; v: number; w: number }[]; value: number };
  const blocks: Block[] = [];
  for (const pt of points) {
    blocks.push({ pts: [pt], value: pt.v });
    while (blocks.length >= 2) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.value <= b.value) break;
      const pts = [...a.pts, ...b.pts];
      const value = weightedMedian(pts.map((x) => ({ v: x.v, w: x.w }))) ?? b.value;
      blocks.splice(blocks.length - 2, 2, { pts, value });
    }
  }
  const out = new Map<number, number>();
  for (const b of blocks) for (const pt of b.pts) out.set(pt.p, b.value);
  return out;
}

function choiceKey(resolver: TelecrmPropertyChoiceResolver, raw: string | null | undefined): { key: string; label: string } | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const label = resolver.labelOf('property', text) || (/^opt[_-]?\d+$/i.test(text) ? '' : text);
  if (!label) return null;
  return { key: label.replace(/\s+/g, '').toLowerCase(), label };
}

function computeBase(rows: TrainRow[]): Map<number, number> {
  const byP = new Map<number, TrainRow[]>();
  for (const r of rows) {
    const list = byP.get(r.p) ?? [];
    list.push(r);
    byP.set(r.p, list);
  }
  const ps = [...byP.keys()];
  if (ps.length === 0) return new Map();
  const lo = Math.max(MIN_P, Math.min(...ps));
  const hi = Math.min(MAX_P, Math.max(...ps));
  const points: { p: number; v: number; w: number }[] = [];
  for (let p = lo; p <= hi; p += 1) {
    const vals: { v: number; w: number }[] = [];
    for (let k = 0; k <= MAX_WINDOW; k += 1) {
      const near = k === 0 ? byP.get(p) ?? [] : [...(byP.get(p - k) ?? []), ...(byP.get(p + k) ?? [])];
      for (const r of near) {
        // 다른 평수 예약은 「평당 금액 × 이 평수」로 바꿔서 덜 반영
        vals.push({ v: k === 0 ? r.amount : (r.amount / r.p) * p, w: k === 0 ? r.w : r.w / (1 + k) });
      }
      if (vals.length >= MIN_BASE_ROWS) break;
    }
    const med = weightedMedian(vals);
    if (med != null) points.push({ p, v: med, w: Math.max(1, (byP.get(p) ?? []).length) });
  }
  const mono = monotoneNonDecreasing(points);
  const out = new Map<number, number>();
  for (const [p, v] of mono) out.set(p, round1000(v));
  return out;
}

function baseAt(model: Pick<Model, 'base' | 'minP' | 'maxP'>, p: number): number | null {
  const hit = model.base.get(p);
  if (hit != null) return hit;
  if (p > model.maxP) {
    const top = model.base.get(model.maxP);
    return top != null ? round1000((top / model.maxP) * p) : null;
  }
  if (p < model.minP) return model.base.get(model.minP) ?? null;
  // 사이가 비어 있으면 가까운 평수로
  for (let k = 1; k <= 10; k += 1) {
    const a = model.base.get(p - k);
    const b = model.base.get(p + k);
    if (a != null && b != null) return round1000((a + b) / 2);
    if (a != null) return round1000((a / (p - k)) * p);
    if (b != null) return round1000((b / (p + k)) * p);
  }
  return null;
}

function computeTypical(rows: TrainRow[]): Map<number, Typical> {
  const byP = new Map<number, TrainRow[]>();
  for (const r of rows) {
    const list = byP.get(r.p) ?? [];
    list.push(r);
    byP.set(r.p, list);
  }
  const out = new Map<number, Typical>();
  for (const p of byP.keys()) {
    const near = [...(byP.get(p - 1) ?? []), ...(byP.get(p) ?? []), ...(byP.get(p + 1) ?? [])].filter((r) => !r.oneRoom);
    const pick = (f: (r: TrainRow) => number | null) =>
      weightedMode(near.map((r) => ({ v: f(r), w: r.w })).filter((x): x is { v: number; w: number } => x.v != null));
    out.set(p, { rooms: pick((r) => r.rooms), baths: pick((r) => r.baths), balc: pick((r) => r.balc) });
  }
  return out;
}

function typicalAt(model: Pick<Model, 'typical'>, p: number): Typical | null {
  for (let k = 0; k <= 5; k += 1) {
    const t = model.typical.get(p) ?? model.typical.get(p - k) ?? model.typical.get(p + k);
    if (t) return t;
  }
  return null;
}

/** 그룹별 차이 금액 — 기준 그룹(0)과 비교 */
function groupAdjust(
  rows: { g: number | string; e: number; w: number }[],
  baseline: number | string | null,
): Map<number | string, number> {
  const groups = new Map<number | string, { v: number; w: number }[]>();
  for (const r of rows) {
    const list = groups.get(r.g) ?? [];
    list.push({ v: r.e, w: r.w });
    groups.set(r.g, list);
  }
  const ref = baseline != null && (groups.get(baseline)?.length ?? 0) >= MIN_ADJ_ROWS ? weightedMedian(groups.get(baseline)!) ?? 0 : 0;
  const out = new Map<number | string, number>();
  for (const [g, list] of groups) {
    if (g === baseline || list.length < MIN_ADJ_ROWS) continue;
    const med = weightedMedian(list);
    if (med == null) continue;
    const adj = round1000(med - ref);
    if (Math.abs(adj) >= MIN_ADJ_WON) out.set(g, adj);
  }
  return out;
}

async function trainModel(tenantId: string, operatingCompanyId: string | null): Promise<Model | null> {
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400000);
  const select = {
    areaPyeong: true,
    serviceTotalAmount: true,
    propertyType: true,
    isOneRoom: true,
    roomCount: true,
    bathroomCount: true,
    balconyCount: true,
    inquiry: { select: { createdAt: true, operatingCompanyId: true } },
  } as const;
  const [allRows, resolver] = await Promise.all([
    prisma.telecrmQuoteCrewLearningSnapshot.findMany({
      where: { tenantId, serviceTotalAmount: { gt: 0 }, areaPyeong: { gt: 0 }, inquiry: { createdAt: { gte: since } } },
      select,
    }),
    loadTelecrmPropertyChoiceResolver(tenantId),
  ]);
  const brandRows = operatingCompanyId ? allRows.filter((r) => r.inquiry?.operatingCompanyId === operatingCompanyId) : [];
  const scope: 'brand' | 'tenant' = brandRows.length >= BRAND_MIN_ROWS ? 'brand' : 'tenant';
  const source = scope === 'brand' ? brandRows : allRows;
  const now = Date.now();
  let rows: TrainRow[] = source
    .map((r) => {
      const p = Math.round(Number(r.areaPyeong));
      const ageDays = Math.max(0, (now - (r.inquiry?.createdAt?.getTime() ?? now)) / 86400000);
      const type = choiceKey(resolver, r.propertyType);
      return {
        p,
        amount: Number(r.serviceTotalAmount),
        w: Math.pow(0.5, ageDays / HALF_LIFE_DAYS),
        typeKey: type?.key ?? null,
        typeLabel: type?.label ?? null,
        rooms: r.roomCount,
        baths: r.bathroomCount,
        balc: r.balconyCount,
        oneRoom: r.isOneRoom,
      };
    })
    .filter((r) => r.p >= MIN_P && r.p <= MAX_P && r.amount > 0);
  if (rows.length < MIN_BASE_ROWS) return null;

  // 1차 기본 금액 → 너무 벗어난 예약 빼고 다시
  const base0 = computeBase(rows);
  rows = rows.filter((r) => {
    const b = base0.get(r.p);
    return b == null || (r.amount >= b * OUTLIER_LOW && r.amount <= b * OUTLIER_HIGH);
  });
  const typical = computeTypical(rows);

  // 건물 유형 — 가장 많은 유형을 기준(0원)으로
  const typeCounts = new Map<string, number>();
  const typeLabels = new Map<string, string>();
  for (const r of rows) {
    if (!r.typeKey) continue;
    typeCounts.set(r.typeKey, (typeCounts.get(r.typeKey) ?? 0) + 1);
    if (r.typeLabel) typeLabels.set(r.typeKey, r.typeLabel);
  }
  const mainType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const diffOf = (r: TrainRow, pick: (r: TrainRow) => number | null, typ: (t: Typical) => number | null): number | null => {
    if (r.oneRoom) return null;
    const v = pick(r);
    const t = typicalAt({ typical }, r.p);
    const tv = t ? typ(t) : null;
    return v == null || tv == null ? null : Math.max(-2, Math.min(3, v - tv));
  };
  const bathDiff = rows.map((r) => diffOf(r, (x) => x.baths, (t) => t.baths));
  const roomDiff = rows.map((r) => diffOf(r, (x) => x.rooms, (t) => t.rooms));
  const balcDiff = rows.map((r) => diffOf(r, (x) => x.balc, (t) => t.balc));

  let typeAdj = new Map<string, number>();
  let bathAdj = new Map<number, number>();
  let roomAdj = new Map<number, number>();
  let balcAdj = new Map<number, number>();
  let oneRoomAdj = 0;
  let base = new Map<number, number>();
  let partial = { base, minP: 0, maxP: 0 };
  const adjOf = (i: number, skip?: 'type' | 'bath' | 'room' | 'balc' | 'one') => {
    const r = rows[i];
    let sum = 0;
    if (skip !== 'type' && r.typeKey) sum += typeAdj.get(r.typeKey) ?? 0;
    if (skip !== 'bath' && bathDiff[i] != null) sum += bathAdj.get(bathDiff[i] as number) ?? 0;
    if (skip !== 'room' && roomDiff[i] != null) sum += roomAdj.get(roomDiff[i] as number) ?? 0;
    if (skip !== 'balc' && balcDiff[i] != null) sum += balcAdj.get(balcDiff[i] as number) ?? 0;
    if (skip !== 'one' && r.oneRoom) sum += oneRoomAdj;
    return sum;
  };

  // 기본 금액과 항목별 금액을 번갈아 3번 다시 맞춤 — 기본 금액은 「가장 흔한 유형·구조」 기준이 되도록
  for (let iter = 0; iter < 3; iter += 1) {
    base = computeBase(rows.map((r, i) => ({ ...r, amount: r.amount - adjOf(i) })));
    if (base.size === 0) return null;
    const ps = [...base.keys()];
    partial = { base, minP: Math.min(...ps), maxP: Math.max(...ps) };
    const residual = (i: number, skip: 'type' | 'bath' | 'room' | 'balc' | 'one') =>
      rows[i].amount - (baseAt(partial, rows[i].p) ?? rows[i].amount) - adjOf(i, skip);

    const tRaw = groupAdjust(
      rows.map((r, i) => (r.typeKey ? { g: r.typeKey, e: residual(i, 'type'), w: r.w } : null)).filter(
        (x): x is { g: string; e: number; w: number } => x != null,
      ),
      mainType,
    );
    typeAdj = new Map([...tRaw].map(([k, v]) => [String(k), v]));
    const fitDiff = (diffs: (number | null)[], skip: 'bath' | 'room' | 'balc') =>
      groupAdjust(
        rows
          .map((r, i) => (diffs[i] != null ? { g: diffs[i] as number, e: residual(i, skip), w: r.w } : null))
          .filter((x): x is { g: number; e: number; w: number } => x != null),
        0,
      ) as Map<number, number>;
    bathAdj = fitDiff(bathDiff, 'bath');
    roomAdj = fitDiff(roomDiff, 'room');
    balcAdj = fitDiff(balcDiff, 'balc');
    oneRoomAdj =
      (groupAdjust(
        rows.map((r, i) => ({ g: r.oneRoom ? 1 : 0, e: residual(i, 'one'), w: r.w })),
        0,
      ).get(1) as number | undefined) ?? 0;
  }

  return {
    trainedAt: new Date(),
    sampleCount: rows.length,
    scope,
    ...partial,
    typical,
    typeAdj,
    typeLabels,
    bathAdj,
    roomAdj,
    balcAdj,
    oneRoomAdj,
    resolver,
  };
}

async function getModel(tenantId: string, operatingCompanyId: string | null): Promise<Model | null> {
  const key = `${tenantId}|${operatingCompanyId ?? ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = trainModel(tenantId, operatingCompanyId).catch((e) => {
    console.error('[telecrm-ai-quote] train failed', e instanceof Error ? e.message : e);
    cache.delete(key);
    return null;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** 다시 배우기 (학습 데이터 다시 모은 직후 등) */
export function invalidateTelecrmAiQuoteModel(tenantId: string): void {
  for (const key of cache.keys()) if (key.startsWith(`${tenantId}|`)) cache.delete(key);
}

export async function predictTelecrmAiQuote(
  tenantId: string,
  input: {
    operatingCompanyId?: string | null;
    areaPyeong: number;
    propertyType?: string | null;
    isOneRoom?: boolean;
    roomCount?: number | null;
    bathroomCount?: number | null;
    balconyCount?: number | null;
  },
): Promise<TelecrmAiQuote | null> {
  const model = await getModel(tenantId, input.operatingCompanyId?.trim() || null);
  if (!model) return null;
  const p = Math.max(1, Math.round(input.areaPyeong));
  const base = baseAt(model, p);
  if (base == null) return null;

  const parts: TelecrmAiQuotePart[] = [];
  const type = choiceKey(model.resolver, input.propertyType);
  const typeAdj = type ? model.typeAdj.get(type.key) ?? 0 : 0;
  parts.push({ label: typeAdj === 0 && type ? `${p}평 ${type.label} 기본` : `${p}평 기본`, amountWon: base });
  if (type && typeAdj !== 0) parts.push({ label: model.typeLabels.get(type.key) ?? type.label, amountWon: typeAdj });

  if (input.isOneRoom) {
    if (model.oneRoomAdj !== 0) parts.push({ label: '원룸', amountWon: model.oneRoomAdj });
  } else {
    const t = typicalAt(model, p);
    const addDiff = (v: number | null | undefined, tv: number | null | undefined, table: Map<number, number>, label: string) => {
      if (v == null || tv == null) return;
      const adj = table.get(Math.max(-2, Math.min(3, v - tv))) ?? 0;
      if (adj !== 0) parts.push({ label, amountWon: adj });
    };
    addDiff(input.bathroomCount, t?.baths, model.bathAdj, `화장실 ${input.bathroomCount}개`);
    addDiff(input.roomCount, t?.rooms, model.roomAdj, `방 ${input.roomCount}개`);
    addDiff(input.balconyCount, t?.balc, model.balcAdj, `베란다 ${input.balconyCount}개`);
  }

  const sum = parts.reduce((s, x) => s + x.amountWon, 0);
  const amountWon = Math.max(10000, Math.round(sum / 10000) * 10000);
  return {
    amountWon,
    parts,
    sampleCount: model.sampleCount,
    trainedAt: model.trainedAt.toISOString(),
    scope: model.scope,
  };
}
