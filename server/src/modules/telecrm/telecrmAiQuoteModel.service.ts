/**
 * 텔레CRM AI 견적 — 과거 예약으로 「우리 업체 표준 가격」을 배우고, 조건을 넣으면 1만원 단위 금액 하나로 답한다.
 *
 * 구조가 먼저, 평수는 그다음 (실제 가격이 그렇게 정해짐 — 예: 14평이라도 방3·화2면 25만원):
 *  1) 구조(방·화장실 수, 원룸) 묶음별로 평수에 따른 금액을 배움.
 *     같은 구조 예약끼리만 비교하고, 가까운 평수 예약은 금액 그대로 씀(구조가 같으면 평수가 조금 달라도 같은 가격대).
 *  2) 구조를 모르거나 그 구조 예약이 적으면 평수만으로 배운 금액을 씀.
 *  3) 건물 유형(빌라·오피스텔 등)은 구조 금액과의 차이가 20건 이상 일관되게 5천원 이상일 때만 더하고 뺌.
 *  평수별로 최근 예약 60건까지만 보고, 최근 예약일수록 크게 반영(3개월 지나면 절반). 평수가 클수록 금액이 줄지 않게 맞춤.
 *  6시간마다(또는 학습 데이터를 다시 모으면 바로) 새 예약까지 넣어 다시 배움. 같은 데이터면 늘 같은 결과.
 */
import { prisma } from '../../lib/prisma.js';
import type { TelecrmAiQuote, TelecrmAiQuotePart } from '../../lib/telecrmQuoteCrewLearning.js';
import {
  loadTelecrmPropertyChoiceResolver,
  type TelecrmPropertyChoiceResolver,
} from './telecrmPropertyChoices.service.js';

const HALF_LIFE_DAYS = 90;
const MAX_AGE_DAYS = 2 * 365;
const BASE_RECENT_ROWS = 60;
const MIN_BASE_ROWS = 8;
const MIN_GROUP_POINT_ROWS = 5;
const MAX_WINDOW = 5;
const MIN_GROUP_ROWS = 15;
const MIN_ADJ_ROWS = 20;
const MIN_TYPE_ADJ_WON = 5000;
const OUTLIER_LOW = 0.7;
const OUTLIER_HIGH = 1.45;
const BRAND_MIN_ROWS = 300;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_P = 3;
const MAX_P = 150;

type TrainRow = {
  p: number;
  amount: number;
  w: number;
  age: number;
  typeKey: string | null;
  typeLabel: string | null;
  structKey: string | null;
};

type Curve = { points: Map<number, number>; minP: number; maxP: number };

type Model = {
  trainedAt: Date;
  sampleCount: number;
  scope: 'brand' | 'tenant';
  overall: Curve;
  groups: Map<string, Curve>;
  typeAdj: Map<string, number>;
  typeLabels: Map<string, string>;
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

/** 구조 묶음 이름 — 원룸은 따로, 아니면 방·화장실 수 둘 다 있어야 묶음 */
function structKeyOf(isOneRoom: boolean, rooms: number | null | undefined, baths: number | null | undefined): string | null {
  if (isOneRoom) return 'oneroom';
  if (rooms == null || baths == null) return null;
  return `${rooms}-${baths}`;
}

function structLabelOf(key: string): string {
  if (key === 'oneroom') return '원룸';
  const [r, b] = key.split('-');
  return `방${r}·화${b}`;
}

/**
 * 평수가 클수록 금액이 줄지 않게 — 거꾸로 된 구간은 묶어서 그 구간의 가운데 금액으로 맞춤
 * (평균이 아니라 가운데 금액이라, 한 평수만 싸게 받은 경우 앞뒤 평수가 같이 내려가지 않음)
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

/**
 * 평수별 금액 곡선.
 * scaleNeighbors: true 면 가까운 평수 예약을 「평당 금액 × 이 평수」로 (평수 곡선),
 *   평수 곡선(Curve)을 주면 그 곡선이 오르내린 비율만큼만 맞춤 (구조 묶음 — 평평한 구간은 금액 그대로)
 */
function computeCurve(rows: TrainRow[], scaleNeighbors: boolean | Curve, minRows: number): Curve | null {
  const byP = new Map<number, TrainRow[]>();
  for (const r of rows) {
    const list = byP.get(r.p) ?? [];
    list.push(r);
    byP.set(r.p, list);
  }
  const ps = [...byP.keys()];
  if (ps.length === 0) return null;
  const lo = Math.max(MIN_P, Math.min(...ps));
  const hi = Math.min(MAX_P, Math.max(...ps));
  const points: { p: number; v: number; w: number }[] = [];
  for (let p = lo; p <= hi; p += 1) {
    const vals: { v: number; w: number; age: number }[] = [];
    for (let k = 0; k <= MAX_WINDOW; k += 1) {
      const near = k === 0 ? byP.get(p) ?? [] : [...(byP.get(p - k) ?? []), ...(byP.get(p + k) ?? [])];
      for (const r of near) {
        let v = r.amount;
        if (k > 0 && scaleNeighbors === true) v = (r.amount / r.p) * p;
        else if (k > 0 && scaleNeighbors !== false && scaleNeighbors !== true) {
          // 구조 묶음: 평수 곡선이 평평한 구간이면 그대로, 오르는 구간이면 그만큼만 올리고 내림
          const here = overallAt(scaleNeighbors, p);
          const there = overallAt(scaleNeighbors, r.p);
          // 더 작은 집은 깎지 않음(같은 구조면 최소 그 가격), 더 큰 집만 평수 곡선이 오른 만큼 올림
          if (here != null && there != null && there > 0) v = r.amount * Math.max(1, here / there);
        }
        vals.push({ v, w: k === 0 ? r.w : r.w / (1 + k), age: r.age });
      }
      if (vals.length >= minRows) break;
    }
    if (vals.length < minRows) continue;
    const recent = vals.sort((a, b) => a.age - b.age).slice(0, BASE_RECENT_ROWS);
    const med = weightedMedian(recent);
    if (med != null) points.push({ p, v: med, w: Math.max(0.01, recent.reduce((sum, x) => sum + x.w, 0)) });
  }
  if (points.length === 0) return null;
  const mono = monotoneNonDecreasing(points);
  const out = new Map<number, number>();
  // 실제 가격이 1만원 단위라 곡선도 1만원 단위로 — 근거 줄이 「+27,000원」처럼 어색하지 않게
  for (const [p, v] of mono) out.set(p, Math.round(v / 10000) * 10000);
  const keys = [...out.keys()];
  return { points: out, minP: Math.min(...keys), maxP: Math.max(...keys) };
}

/** 평수 곡선에서 금액 — 범위 밖이면 끝 금액을 기준으로 */
function overallAt(curve: Curve, p: number): number | null {
  const hit = curve.points.get(p);
  if (hit != null) return hit;
  if (p > curve.maxP) {
    const top = curve.points.get(curve.maxP);
    return top != null ? round1000((top / curve.maxP) * p) : null;
  }
  if (p < curve.minP) return curve.points.get(curve.minP) ?? null;
  for (let k = 1; k <= 10; k += 1) {
    const a = curve.points.get(p - k);
    if (a != null) return a;
  }
  return null;
}

/**
 * 구조 묶음 금액 — 그 구조 예약이 있는 평수 범위 안이면 그대로,
 * 더 작은 평수면 그 구조의 가장 작은 평수 금액(구조가 같으면 최소 이 가격),
 * 더 큰 평수면 「그 구조 끝 금액」과 「평수 금액」 중 큰 것
 */
function groupAt(group: Curve, overall: Curve, p: number): number | null {
  const hit = group.points.get(p);
  if (hit != null) return hit;
  if (p < group.minP) return group.points.get(group.minP) ?? null;
  if (p > group.maxP) {
    const top = group.points.get(group.maxP) ?? 0;
    const byPyeong = overallAt(overall, p) ?? 0;
    return Math.max(top, byPyeong) || null;
  }
  for (let k = 1; k <= 10; k += 1) {
    const a = group.points.get(p - k);
    if (a != null) return a;
  }
  return null;
}

function choiceKey(resolver: TelecrmPropertyChoiceResolver, raw: string | null | undefined): { key: string; label: string } | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const label = resolver.labelOf('property', text) || (/^opt[_-]?\d+$/i.test(text) ? '' : text);
  if (!label) return null;
  return { key: label.replace(/\s+/g, '').toLowerCase(), label };
}

async function trainModel(tenantId: string, operatingCompanyId: string | null): Promise<Model | null> {
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400000);
  const [allRows, resolver] = await Promise.all([
    prisma.telecrmQuoteCrewLearningSnapshot.findMany({
      where: {
        tenantId,
        serviceTotalAmount: { gt: 0 },
        areaPyeong: { gt: 0 },
        inquiry: { createdAt: { gte: since } },
      },
      select: {
        areaPyeong: true,
        serviceTotalAmount: true,
        propertyType: true,
        isOneRoom: true,
        roomCount: true,
        bathroomCount: true,
        inquiry: { select: { createdAt: true, operatingCompanyId: true } },
      },
    }),
    loadTelecrmPropertyChoiceResolver(tenantId),
  ]);
  const brandRows = operatingCompanyId ? allRows.filter((r) => r.inquiry?.operatingCompanyId === operatingCompanyId) : [];
  const scope: 'brand' | 'tenant' = brandRows.length >= BRAND_MIN_ROWS ? 'brand' : 'tenant';
  const source = scope === 'brand' ? brandRows : allRows;
  const now = Date.now();
  let rows: TrainRow[] = source
    .map((r) => {
      const ageDays = Math.max(0, (now - (r.inquiry?.createdAt?.getTime() ?? now)) / 86400000);
      const type = choiceKey(resolver, r.propertyType);
      return {
        p: Math.round(Number(r.areaPyeong)),
        amount: Number(r.serviceTotalAmount),
        w: Math.pow(0.5, ageDays / HALF_LIFE_DAYS),
        age: ageDays,
        typeKey: type?.key ?? null,
        typeLabel: type?.label ?? null,
        structKey: structKeyOf(r.isOneRoom, r.roomCount, r.bathroomCount),
      };
    })
    .filter((r) => r.p >= MIN_P && r.p <= MAX_P && r.amount > 0);
  if (rows.length < MIN_BASE_ROWS) return null;

  // 1차 곡선 → 자기 구조(없으면 평수) 금액에서 너무 벗어난 예약(특수 작업 등)은 빼고 다시
  const overall0 = computeCurve(rows, true, MIN_BASE_ROWS);
  if (!overall0) return null;
  const groups0 = buildGroups(rows, overall0);
  rows = rows.filter((r) => {
    const g = r.structKey ? groups0.get(r.structKey) : undefined;
    const ref = g ? groupAt(g, overall0, r.p) : overallAt(overall0, r.p);
    return ref == null || (r.amount >= ref * OUTLIER_LOW && r.amount <= ref * OUTLIER_HIGH);
  });
  const overall = computeCurve(rows, true, MIN_BASE_ROWS);
  if (!overall) return null;
  const groups = buildGroups(rows, overall);

  // 건물 유형 — 구조(또는 평수) 금액과의 차이. 가장 많은 유형을 기준(0원)으로
  const typeCounts = new Map<string, number>();
  const typeLabels = new Map<string, string>();
  const byType = new Map<string, { v: number; w: number }[]>();
  for (const r of rows) {
    if (!r.typeKey) continue;
    typeCounts.set(r.typeKey, (typeCounts.get(r.typeKey) ?? 0) + 1);
    if (r.typeLabel) typeLabels.set(r.typeKey, r.typeLabel);
    const g = r.structKey ? groups.get(r.structKey) : undefined;
    const ref = g ? groupAt(g, overall, r.p) : overallAt(overall, r.p);
    if (ref == null) continue;
    const list = byType.get(r.typeKey) ?? [];
    list.push({ v: r.amount - ref, w: r.w });
    byType.set(r.typeKey, list);
  }
  const mainType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mainRef = mainType ? weightedMedian(byType.get(mainType) ?? []) ?? 0 : 0;
  const typeAdj = new Map<string, number>();
  for (const [key, list] of byType) {
    if (key === mainType || list.length < MIN_ADJ_ROWS) continue;
    const med = weightedMedian(list);
    if (med == null) continue;
    const adj = round1000(med - mainRef);
    if (Math.abs(adj) >= MIN_TYPE_ADJ_WON) typeAdj.set(key, adj);
  }

  return {
    trainedAt: new Date(),
    sampleCount: rows.length,
    scope,
    overall,
    groups,
    typeAdj,
    typeLabels,
    resolver,
  };
}

function buildGroups(rows: TrainRow[], overall: Curve): Map<string, Curve> {
  const byKey = new Map<string, TrainRow[]>();
  for (const r of rows) {
    if (!r.structKey) continue;
    const list = byKey.get(r.structKey) ?? [];
    list.push(r);
    byKey.set(r.structKey, list);
  }
  const out = new Map<string, Curve>();
  for (const [key, list] of byKey) {
    if (list.length < MIN_GROUP_ROWS) continue;
    const curve = computeCurve(list, overall, MIN_GROUP_POINT_ROWS);
    if (curve) out.set(key, curve);
  }
  return out;
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
  const byPyeong = overallAt(model.overall, p);
  if (byPyeong == null) return null;

  const parts: TelecrmAiQuotePart[] = [];
  const structKey = structKeyOf(Boolean(input.isOneRoom), input.roomCount, input.bathroomCount);
  const group = structKey ? model.groups.get(structKey) : undefined;
  const byStruct = group ? groupAt(group, model.overall, p) : null;
  const structLabel = structKey ? structLabelOf(structKey) : null;

  if (byStruct != null && structLabel) {
    const diff = byStruct - byPyeong;
    if (diff === 0) {
      parts.push({ label: `${p}평 ${structLabel} 기본`, amountWon: byStruct });
    } else {
      // 평수로만 보면 얼마인데, 구조 때문에 얼마가 더해지거나 빠지는지 그대로 보여 줌
      parts.push({ label: `${p}평 기본`, amountWon: byPyeong });
      parts.push({ label: `${structLabel} 구조`, amountWon: diff });
    }
  } else {
    parts.push({ label: `${p}평 기본`, amountWon: byPyeong });
  }

  const type = choiceKey(model.resolver, input.propertyType);
  const typeAdj = type ? model.typeAdj.get(type.key) ?? 0 : 0;
  if (type && typeAdj !== 0) {
    parts.push({ label: model.typeLabels.get(type.key) ?? type.label, amountWon: typeAdj });
  } else if (type && parts.length === 1) {
    parts[0] = { ...parts[0], label: `${parts[0].label.replace(/ 기본$/, '')} ${type.label} 기본` };
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
