/**
 * 텔레CRM AI 견적 기준표 — 위에서부터 첫 줄이 맞으면 그 금액.
 * 소형은 구조와 무관. 유형을 모르고 원룸 계열이면 소형 줄을 쓴다.
 * 방·화·베가 모두 비어 있으면(원룸도 아니면) 기준표를 쓰지 않는다.
 */
import type { AiQuoteClassified } from './telecrmAiQuoteClassify.js';

export type AiQuoteBaseKind = 'fixed' | 'perPyeong';

export type AiQuoteBaseRow = {
  id?: string;
  sortOrder: number;
  isActive: boolean;
  typeGroup: 'small' | 'general' | null;
  /** true/false 면 원룸 계열 여부를 고정. null 이면 따지지 않음 */
  oneRoomLike: boolean | null;
  /** 구조 범위에 더해, 원룸 계열이면 이 줄도 맞음 (일반 22평 이하 줄) */
  orOneRoom: boolean;
  roomsMin: number | null;
  roomsMax: number | null;
  bathsMin: number | null;
  bathsMax: number | null;
  balconiesMin: number | null;
  balconiesMax: number | null;
  pyeongMin: number | null;
  pyeongMax: number | null;
  kind: AiQuoteBaseKind;
  amountWon: number;
  label: string;
};

export type AiQuoteResolution = {
  amountWon: number;
  label: string;
  source: 'base' | 'counselor' | 'group' | 'pyeong';
  baseRowId: string | null;
};

const STRUCTURE_EMPTY = (c: AiQuoteClassified) =>
  c.rooms == null && c.baths == null && c.balconies == null && !c.isOneRoomLike;

function pyeongOk(row: AiQuoteBaseRow, pyeong: number): boolean {
  if (row.pyeongMin != null && pyeong < row.pyeongMin) return false;
  if (row.pyeongMax != null && pyeong > row.pyeongMax) return false;
  return true;
}

function typeOk(row: AiQuoteBaseRow, c: AiQuoteClassified): boolean {
  if (row.typeGroup === 'small') {
    return c.typeGroup === 'small' || (c.typeGroup == null && c.isOneRoomLike);
  }
  if (row.typeGroup === 'general') {
    if (c.typeGroup !== 'general') return false;
    if (STRUCTURE_EMPTY(c)) return false;
    return true;
  }
  return !STRUCTURE_EMPTY(c) || c.typeGroup === 'small';
}

/**
 * 구조 칸이 있는 줄.
 * 적힌 칸이 범위를 벗어나면 탈락.
 * 칸이 비어 있으면, 다른 칸이 맞을 때만 그 빈 칸은 넘어간다 (베란다만 빠진 경우).
 * 구조 칸이 전부 비어 있으면 맞지 않음 — 원룸 OR 는 호출하는 쪽에서 본다.
 */
function structureOk(row: AiQuoteBaseRow, c: AiQuoteClassified): boolean {
  const dims: [number | null, number | null, number | null][] = [
    [c.rooms, row.roomsMin, row.roomsMax],
    [c.baths, row.bathsMin, row.bathsMax],
    [c.balconies, row.balconiesMin, row.balconiesMax],
  ];
  let constrained = 0;
  let presentOk = 0;
  for (const [value, min, max] of dims) {
    if (min == null && max == null) continue;
    constrained += 1;
    if (value == null) continue;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    presentOk += 1;
  }
  if (constrained === 0) return true;
  return presentOk > 0;
}

export function matchBaseRow(rows: AiQuoteBaseRow[], c: AiQuoteClassified): AiQuoteBaseRow | null {
  const active = rows.filter((r) => r.isActive).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  for (const row of active) {
    if (!typeOk(row, c) || !pyeongOk(row, c.pyeong)) continue;
    if (row.oneRoomLike === true && !c.isOneRoomLike) continue;
    if (row.oneRoomLike === false && c.isOneRoomLike) continue;
    if (structureOk(row, c)) return row;
    if (row.orOneRoom && c.isOneRoomLike) return row;
  }
  return null;
}

export function baseAmountWon(row: AiQuoteBaseRow, pyeong: number): number {
  if (row.kind === 'perPyeong') return Math.round(row.amountWon * pyeong);
  return row.amountWon;
}

export function basePartLabel(propertyLabel: string | null | undefined, row: AiQuoteBaseRow): string {
  const name = String(propertyLabel ?? '').trim() || (row.typeGroup === 'small' ? '소형' : '일반');
  return `${name}·${row.label} (기준표)`;
}

/** 최근 견적일수록 무게. 14일마다 절반. */
export function counselorWeightedMedian(rows: { amountWon: number; at: number }[], now = Date.now()): number | null {
  const list = rows
    .filter((r) => Number.isFinite(r.amountWon) && r.amountWon > 0)
    .map((r) => {
      const ageDays = Math.max(0, (now - r.at) / 86400000);
      return { v: r.amountWon, w: Math.pow(0.5, ageDays / 14) };
    })
    .sort((a, b) => a.v - b.v);
  if (list.length === 0) return null;
  const total = list.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of list) {
    acc += x.w;
    if (acc >= total / 2) return x.v;
  }
  return list[list.length - 1].v;
}

export function resolveAiQuoteCore(input: {
  classified: AiQuoteClassified;
  propertyLabel?: string | null;
  baseRows: AiQuoteBaseRow[];
  corrections?: { amountWon: number; at: number }[];
  group?: { count: number; median: number } | null;
  groupLabel?: string | null;
  pyeongCurveWon?: number | null;
  now?: number;
}): AiQuoteResolution | null {
  const hit = matchBaseRow(input.baseRows, input.classified);
  if (hit) {
    return {
      amountWon: baseAmountWon(hit, input.classified.pyeong),
      label: basePartLabel(input.propertyLabel, hit),
      source: 'base',
      baseRowId: hit.id ?? null,
    };
  }
  const corrections = input.corrections ?? [];
  if (corrections.length > 0) {
    const amount = counselorWeightedMedian(corrections, input.now);
    if (amount != null) {
      return {
        amountWon: Math.round(amount / 10000) * 10000,
        label: `상담사 견적 반영 (최근 ${corrections.length}건)`,
        source: 'counselor',
        baseRowId: null,
      };
    }
  }
  if (input.group && input.group.count >= 5 && input.groupLabel) {
    return {
      amountWon: input.group.median,
      label: `${input.groupLabel} 예약 ${input.group.count}건 가운데 금액`,
      source: 'group',
      baseRowId: null,
    };
  }
  if (input.pyeongCurveWon != null) {
    return {
      amountWon: input.pyeongCurveWon,
      label: `${input.classified.pyeong}평 평수 기준(같은 구조 예약 부족)`,
      source: 'pyeong',
      baseRowId: null,
    };
  }
  return null;
}

export type BaseDriftRecord = {
  baseRowId: string;
  label: string;
  tableAmountWon: number;
  sentAmountWon: number;
  at: string;
};

export type BaseDriftItem = {
  baseRowId: string;
  label: string;
  tableAmountWon: number;
  sentAmountWon: number;
  count: number;
  lastAt: string;
};

/** 기준표와 다른 금액이 최근 30일 같은 줄·같은 금액으로 3번 이상 */
export function listBaseDriftItems(args: {
  records: BaseDriftRecord[];
  dismissals?: { baseRowId: string; sentAmountWon: number; until: string }[];
  now: Date;
  withinDays?: number;
}): BaseDriftItem[] {
  const within = args.withinDays ?? 30;
  const since = args.now.getTime() - within * 86400000;
  const hidden = new Set(
    (args.dismissals ?? [])
      .filter((d) => new Date(d.until).getTime() > args.now.getTime())
      .map((d) => `${d.baseRowId}|${d.sentAmountWon}`),
  );
  const groups = new Map<string, BaseDriftItem>();
  for (const row of args.records) {
    const at = new Date(row.at).getTime();
    if (!Number.isFinite(at) || at < since) continue;
    if (row.sentAmountWon === row.tableAmountWon) continue;
    const key = `${row.baseRowId}|${row.sentAmountWon}`;
    if (hidden.has(key)) continue;
    const prev = groups.get(key);
    if (!prev) {
      groups.set(key, {
        baseRowId: row.baseRowId,
        label: row.label,
        tableAmountWon: row.tableAmountWon,
        sentAmountWon: row.sentAmountWon,
        count: 1,
        lastAt: row.at,
      });
      continue;
    }
    prev.count += 1;
    if (at > new Date(prev.lastAt).getTime()) {
      prev.lastAt = row.at;
      prev.tableAmountWon = row.tableAmountWon;
      prev.label = row.label;
    }
  }
  return [...groups.values()].filter((g) => g.count >= 3).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/** 업체 코드 sk 기본 8줄. 마이그레이션 시드와 같은 내용. */
export function skAiQuoteBaseRows(): AiQuoteBaseRow[] {
  const common = { isActive: true, oneRoomLike: null as boolean | null, orOneRoom: false };
  return [
    {
      ...common,
      sortOrder: 1,
      typeGroup: 'small',
      roomsMin: null, roomsMax: null, bathsMin: null, bathsMax: null, balconiesMin: null, balconiesMax: null,
      pyeongMin: null, pyeongMax: 20, kind: 'fixed', amountWon: 150000, label: '20평 이하 → 15만 고정',
    },
    {
      ...common,
      sortOrder: 2,
      typeGroup: 'small',
      roomsMin: null, roomsMax: null, bathsMin: null, bathsMax: null, balconiesMin: null, balconiesMax: null,
      pyeongMin: 21, pyeongMax: null, kind: 'perPyeong', amountWon: 10000, label: '21평 이상 → 평당 1만',
    },
    {
      ...common,
      sortOrder: 3,
      typeGroup: 'general',
      orOneRoom: true,
      roomsMin: null, roomsMax: 2, bathsMin: null, bathsMax: 1, balconiesMin: null, balconiesMax: 1,
      pyeongMin: null, pyeongMax: 22, kind: 'fixed', amountWon: 200000, label: '22평 이하 → 20만 고정',
    },
    {
      ...common,
      sortOrder: 4,
      typeGroup: 'general',
      roomsMin: 2, roomsMax: 2, bathsMin: null, bathsMax: null, balconiesMin: null, balconiesMax: null,
      pyeongMin: 23, pyeongMax: null, kind: 'perPyeong', amountWon: 10000, label: '23평 이상 → 평당 1만',
    },
    {
      ...common,
      sortOrder: 5,
      typeGroup: 'general',
      roomsMin: 3, roomsMax: 3, bathsMin: null, bathsMax: 1, balconiesMin: null, balconiesMax: 1,
      pyeongMin: null, pyeongMax: 24, kind: 'fixed', amountWon: 240000, label: '24평 이하 → 24만 고정',
    },
    {
      ...common,
      sortOrder: 6,
      typeGroup: 'general',
      roomsMin: 3, roomsMax: 3, bathsMin: null, bathsMax: 1, balconiesMin: null, balconiesMax: 1,
      pyeongMin: 25, pyeongMax: null, kind: 'perPyeong', amountWon: 10000, label: '25평 이상 → 평당 1만',
    },
    {
      ...common,
      sortOrder: 7,
      typeGroup: 'general',
      roomsMin: 3, roomsMax: null, bathsMin: 1, bathsMax: 2, balconiesMin: 1, balconiesMax: 5,
      pyeongMin: null, pyeongMax: 25, kind: 'fixed', amountWon: 250000, label: '25평 이하 → 25만 고정',
    },
    {
      ...common,
      sortOrder: 8,
      typeGroup: 'general',
      roomsMin: 3, roomsMax: null, bathsMin: 1, bathsMax: 2, balconiesMin: 1, balconiesMax: 5,
      pyeongMin: 26, pyeongMax: null, kind: 'perPyeong', amountWon: 10000, label: '26평 이상 → 평당 1만',
    },
  ];
}
