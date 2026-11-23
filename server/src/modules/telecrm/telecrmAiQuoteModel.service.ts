/**
 * 텔레CRM AI 견적 — 유형·구조를 먼저 보고, 기준표가 있으면 그 금액, 없으면 같은 구조의 가운데 금액.
 * 기준표에 없는 조합은 상담사가 보낸 기본청소 금액을 최근 것에 더 무게를 두어 쓴다.
 * 말로 넣은 규칙(최소·최대·더하기·지정·평당)은 그 위에 그대로 얹는다.
 * 평수 소수점은 버린다. 같은 구조 예약이 5건 미만일 때만 평수 곡선을 쓴다.
 */
import { prisma } from '../../lib/prisma.js';
import type {
  TelecrmAiQuote,
  TelecrmAiQuoteModelStatus,
  TelecrmAiQuotePart,
  TelecrmAiQuoteRuleSpec,
} from '../../lib/telecrmQuoteCrewLearning.js';
import { loadActiveTelecrmAiQuoteRuleSpecs } from './telecrmAiQuoteRules.store.js';
import {
  loadTelecrmPropertyChoiceResolver,
  type TelecrmPropertyChoiceResolver,
} from './telecrmPropertyChoices.service.js';
import { classifyAiQuote, structKeyOfClassified, structSpeech } from './telecrmAiQuoteClassify.js';
import { resolveAiQuoteCore } from './telecrmAiQuoteBase.js';
import { listCurveSentQuotes, listOffTableSentQuotes, listTelecrmAiQuoteBaseRows } from './telecrmAiQuoteBase.store.js';
import { judgeTelecrmAiQuoteLoft, loftSurchargeForQuote } from './telecrmAiQuoteLoft.js';
import { getTelecrmAiQuoteLoftAmount } from './telecrmAiQuoteLoft.store.js';

const HALF_LIFE_DAYS = 90;
const MAX_AGE_DAYS = 2 * 365;
const BASE_RECENT_ROWS = 60;
const MIN_BASE_ROWS = 8;
const MIN_GROUP_POINT_ROWS = 5;
const MAX_WINDOW = 5;
const MIN_GROUP_ROWS = 15;
const MIN_STRUCT_MEDIAN_ROWS = 5;
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
  fromSent: boolean;
};

type Curve = { points: Map<number, number>; minP: number; maxP: number };

type Model = {
  trainedAt: Date;
  sampleCount: number;
  scope: 'brand' | 'tenant';
  overall: Curve;
  groups: Map<string, Curve>;
  groupMedians: Map<string, { count: number; median: number }>;
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
  const [allRows, resolver, sentRows] = await Promise.all([
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
    listCurveSentQuotes(tenantId, since).catch(() => []),
  ]);
  const brandRows = operatingCompanyId ? allRows.filter((r) => r.inquiry?.operatingCompanyId === operatingCompanyId) : [];
  const scope: 'brand' | 'tenant' = brandRows.length >= BRAND_MIN_ROWS ? 'brand' : 'tenant';
  const source = scope === 'brand' ? brandRows : allRows;
  const now = Date.now();
  let rows: TrainRow[] = source
    .map((r) => {
      const ageDays = Math.max(0, (now - (r.inquiry?.createdAt?.getTime() ?? now)) / 86400000);
      const type = choiceKey(resolver, r.propertyType);
      const classified = classifyAiQuote({
        propertyTypeLabel: type?.label ?? null,
        isOneRoom: r.isOneRoom,
        roomCount: r.roomCount,
        bathroomCount: r.bathroomCount,
        areaPyeong: r.areaPyeong,
      });
      return {
        p: classified.pyeong,
        amount: Number(r.serviceTotalAmount),
        w: Math.pow(0.5, ageDays / HALF_LIFE_DAYS),
        age: ageDays,
        typeKey: type?.key ?? null,
        typeLabel: type?.label ?? null,
        structKey: structKeyOfClassified(classified),
        fromSent: false,
      };
    })
    .filter((r) => r.p >= MIN_P && r.p <= MAX_P && r.amount > 0);
  if (rows.length < MIN_BASE_ROWS) return null;
  const sentSource = scope === 'brand' && operatingCompanyId
    ? sentRows.filter((r) => r.operatingCompanyId === operatingCompanyId)
    : sentRows;
  const sentTrain: TrainRow[] = sentSource
    .map((r) => {
      const ageDays = Math.max(0, (now - r.createdAt.getTime()) / 86400000);
      const classified = classifyAiQuote({
        propertyTypeLabel: r.typeGroup === 'small' ? '오피스텔' : r.typeGroup === 'general' ? '아파트' : null,
        isOneRoom: r.isOneRoomLike,
        roomCount: r.isOneRoomLike ? 1 : r.rooms,
        bathroomCount: r.baths,
        balconyCount: r.balconies,
        areaPyeong: r.pyeong,
      });
      return {
        p: classified.pyeong,
        amount: r.sentBaseAmountWon,
        w: 3 * Math.pow(0.5, ageDays / HALF_LIFE_DAYS),
        age: ageDays,
        typeKey: r.typeGroup,
        typeLabel: r.typeGroup === 'small' ? '소형' : r.typeGroup === 'general' ? '일반' : null,
        structKey: structKeyOfClassified(classified),
        fromSent: true,
      };
    })
    .filter((r) => r.p >= MIN_P && r.p <= MAX_P && r.amount > 0);
  rows = [...rows, ...sentTrain];

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
  const groupMedians = buildGroupMedians(rows.filter((r) => !r.fromSent));

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
    groupMedians,
    typeAdj,
    typeLabels,
    resolver,
  };
}

function buildGroupMedians(rows: TrainRow[]): Map<string, { count: number; median: number }> {
  const byKey = new Map<string, TrainRow[]>();
  for (const r of rows) {
    if (!r.structKey) continue;
    const list = byKey.get(r.structKey) ?? [];
    list.push(r);
    byKey.set(r.structKey, list);
  }
  const out = new Map<string, { count: number; median: number }>();
  for (const [key, list] of byKey) {
    if (list.length < MIN_STRUCT_MEDIAN_ROWS) continue;
    const med = weightedMedian(list.map((r) => ({ v: r.amount, w: r.w })));
    if (med == null) continue;
    out.set(key, { count: list.length, median: Math.round(med / 10000) * 10000 });
  }
  return out;
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

export type TelecrmAiQuoteInput = {
  operatingCompanyId?: string | null;
  areaPyeong: number;
  propertyType?: string | null;
  isOneRoom?: boolean;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
  /** 접수란 복층 체크. null 이면 메모에서 판단 */
  oneRoomLoft?: boolean | null;
  /** 통화 중 메모와 숨고 고객요청을 이어 붙인 글 */
  memoText?: string | null;
};

/** 지금 배운 상태 — 설정 화면 「마지막 학습」 표시용 */
export async function getTelecrmAiQuoteModelStatus(
  tenantId: string,
  operatingCompanyId?: string | null,
): Promise<Pick<TelecrmAiQuoteModelStatus, 'trainedAt' | 'sampleCount'>> {
  const model = await getModel(tenantId, operatingCompanyId?.trim() || null);
  return { trainedAt: model?.trainedAt.toISOString() ?? null, sampleCount: model?.sampleCount ?? 0 };
}

function normLabel(text: string | null | undefined): string {
  return String(text ?? '').replace(/\s+/g, '').toLowerCase();
}

/** 규칙 조건이 이 손님에게 맞는지 — 규칙에 적힌 칸만 비교 (손님 쪽 값이 비어 있으면 맞지 않음) */
function ruleMatches(
  spec: TelecrmAiQuoteRuleSpec,
  input: TelecrmAiQuoteInput,
  p: number,
  typeLabel: string | null,
): boolean {
  const c = spec.condition ?? {};
  if (c.pyeongMin != null && p < c.pyeongMin) return false;
  if (c.pyeongMax != null && p > c.pyeongMax) return false;
  if (c.roomCount != null && input.roomCount !== c.roomCount) return false;
  if (c.bathroomCount != null && input.bathroomCount !== c.bathroomCount) return false;
  if (c.balconyCount != null && input.balconyCount !== c.balconyCount) return false;
  if (c.isOneRoom != null && Boolean(input.isOneRoom) !== c.isOneRoom) return false;
  if (c.propertyType && normLabel(c.propertyType) !== normLabel(typeLabel)) return false;
  return true;
}

function ruleDelta(spec: TelecrmAiQuoteRuleSpec, current: number, p: number): number {
  const amt = Math.round(Number(spec.action?.amountWon) || 0);
  switch (spec.action?.kind) {
    case 'min':
      return current < amt ? amt - current : 0;
    case 'max':
      return current > amt ? amt - current : 0;
    case 'add':
      return amt;
    case 'set':
      return amt - current;
    case 'perPyeong':
      return p * amt - current;
    default:
      return 0;
  }
}

export async function predictTelecrmAiQuote(
  tenantId: string,
  input: TelecrmAiQuoteInput,
  opts?: {
    /** 미리보기 — 저장된 규칙 대신 이 규칙 목록으로 계산 */
    rulesOverride?: TelecrmAiQuoteRuleSpec[];
  },
): Promise<TelecrmAiQuote | null> {
  const brand = input.operatingCompanyId?.trim() || null;
  const model = await getModel(tenantId, brand);
  const resolver = model?.resolver ?? (await loadTelecrmPropertyChoiceResolver(tenantId));
  const type = choiceKey(resolver, input.propertyType);
  const classified = classifyAiQuote({
    propertyTypeLabel: type?.label ?? null,
    isOneRoom: input.isOneRoom,
    roomCount: input.roomCount,
    bathroomCount: input.bathroomCount,
    balconyCount: input.balconyCount,
    areaPyeong: input.areaPyeong,
  });
  if (classified.pyeong < 1) return null;

  let baseRows: Awaited<ReturnType<typeof listTelecrmAiQuoteBaseRows>> = [];
  try {
    baseRows = await listTelecrmAiQuoteBaseRows(tenantId);
  } catch (e) {
    console.error('[telecrm-ai-quote] base rows failed', e instanceof Error ? e.message : e);
  }

  const structKey = structKeyOfClassified(classified);
  let corrections: { amountWon: number; at: number }[] = [];
  if (structKey) {
    try {
      corrections = await listOffTableSentQuotes({
        tenantId,
        operatingCompanyId: brand,
        typeGroup: classified.typeGroup,
        isOneRoomLike: classified.isOneRoomLike,
        rooms: classified.rooms,
        baths: classified.baths,
        pyeong: classified.pyeong,
      });
    } catch (e) {
      console.error('[telecrm-ai-quote] sent quotes failed', e instanceof Error ? e.message : e);
    }
  }

  const groupStat = structKey ? model?.groupMedians.get(structKey) : undefined;
  const byPyeong = model ? overallAt(model.overall, classified.pyeong) : null;
  const core = resolveAiQuoteCore({
    classified,
    propertyLabel: type?.label ?? null,
    baseRows,
    corrections,
    group: groupStat ?? null,
    groupLabel: structKey ? structSpeech(structKey) : null,
    pyeongCurveWon: byPyeong,
  });
  if (!core) return null;

  const parts: TelecrmAiQuotePart[] = [{ label: core.label, amountWon: core.amountWon }];
  const p = classified.pyeong;
  const rules = opts?.rulesOverride ?? (await loadActiveTelecrmAiQuoteRuleSpecs(tenantId));
  let current = core.amountWon;
  for (const spec of rules) {
    if (!ruleMatches(spec, input, p, type?.label ?? null)) continue;
    const delta = ruleDelta(spec, current, p);
    if (delta === 0) continue;
    parts.push({ label: `규칙: ${spec.summary}`, amountWon: delta, rule: true });
    current += delta;
  }

  const baseWon = Math.max(10000, Math.round(current / 10000) * 10000);
  const loftSetting = await getTelecrmAiQuoteLoftAmount(tenantId, brand).catch(() => 30000);
  const loftAdd = loftSurchargeForQuote(
    judgeTelecrmAiQuoteLoft({ oneRoomLoft: input.oneRoomLoft, text: input.memoText }),
    loftSetting,
  );
  if (loftAdd.addWon > 0 && loftAdd.label) {
    parts.push({ label: loftAdd.label, amountWon: loftAdd.addWon });
  }
  return {
    amountWon: baseWon + loftAdd.addWon,
    parts,
    loft: loftAdd.loft,
    sampleCount: model?.sampleCount ?? 0,
    trainedAt: model?.trainedAt.toISOString() ?? new Date().toISOString(),
    scope: model?.scope ?? 'tenant',
  };
}
