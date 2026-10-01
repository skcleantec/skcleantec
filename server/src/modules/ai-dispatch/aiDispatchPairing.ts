import { haversineKm } from './aiDispatchRules.js';

type Geo = { lat: number | null; lng: number | null };

export function geoKm(a: Geo, b: Geo): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return Math.round(haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 10) / 10;
}

/** 그 현장의 가장 가까운 반대 시간대보다 훨씬 먼 짝은 한 줄로 잇지 않습니다. */
function neighborLimitKm(nearestKm: number): number {
  return Math.max(nearestKm * 1.6, nearestKm + 3);
}

export type SiteStop = { id: string; lat: number | null; lng: number | null };

/**
 * 현장과 현장의 거리로 오전·오후를 묶습니다.
 * 각 현장의 가장 가까운 반대 시간대 근처에 있는 짝만 후보로 두고, 그 안에서 이동 합이 가장 짧은 조합을 고릅니다.
 */
export function matchSitePairs<T extends SiteStop>(ams: T[], pms: T[]): Array<{ am: T; pm: T; between: number }> {
  if (ams.length === 0 || pms.length === 0) return [];
  const nearestOf = (job: T, others: T[]) => {
    let best: number | null = null;
    for (const other of others) {
      const km = geoKm(job, other);
      if (km == null) continue;
      if (best == null || km < best) best = km;
    }
    return best;
  };
  const edgeKm = (am: T, pm: T) => {
    const between = geoKm(am, pm);
    if (between == null) return null;
    const nearestAm = nearestOf(am, pms);
    const nearestPm = nearestOf(pm, ams);
    if (nearestAm == null || nearestPm == null) return null;
    if (between > neighborLimitKm(nearestAm) || between > neighborLimitKm(nearestPm)) return null;
    return between;
  };
  if (pms.length > 16 || ams.length > 24) return greedySitePairs(ams, pms, edgeKm);
  return exactSitePairs(ams, pms, edgeKm);
}

/** 오전은 한 번, 오후는 한 번. 종일은 오전·오후를 둘 다 씁니다. */
export function periodAlreadyTaken(existingSlots: readonly string[], slot: string): boolean {
  const morning = existingSlots.some((item) => item === 'AM' || item === 'ALL_DAY');
  const afternoon = existingSlots.some((item) => item === 'PM' || item === 'ALL_DAY');
  if (slot === 'AM') return morning;
  if (slot === 'PM') return afternoon;
  if (slot === 'ALL_DAY') return morning || afternoon;
  return false;
}

function greedySitePairs<T extends SiteStop>(
  ams: T[],
  pms: T[],
  edgeKm: (am: T, pm: T) => number | null,
): Array<{ am: T; pm: T; between: number }> {
  const edges: Array<{ am: T; pm: T; between: number }> = [];
  for (const am of ams) {
    for (const pm of pms) {
      const between = edgeKm(am, pm);
      if (between == null) continue;
      edges.push({ am, pm, between });
    }
  }
  edges.sort((a, b) => a.between - b.between);
  const usedAm = new Set<string>();
  const usedPm = new Set<string>();
  const pairs: Array<{ am: T; pm: T; between: number }> = [];
  for (const edge of edges) {
    if (usedAm.has(edge.am.id) || usedPm.has(edge.pm.id)) continue;
    usedAm.add(edge.am.id);
    usedPm.add(edge.pm.id);
    pairs.push(edge);
  }
  return pairs;
}

function exactSitePairs<T extends SiteStop>(
  ams: T[],
  pms: T[],
  edgeKm: (am: T, pm: T) => number | null,
): Array<{ am: T; pm: T; between: number }> {
  const m = pms.length;
  const full = 1 << m;
  let prev = new Float64Array(full);
  prev.fill(Number.POSITIVE_INFINITY);
  prev[0] = 0;
  const parentPm: Int16Array[] = [];
  const parentMask: Int32Array[] = [];
  for (let i = 0; i < ams.length; i += 1) {
    const next = new Float64Array(full);
    next.fill(Number.POSITIVE_INFINITY);
    const pmChoice = new Int16Array(full);
    pmChoice.fill(-2);
    const fromMask = new Int32Array(full);
    fromMask.fill(-1);
    for (let mask = 0; mask < full; mask += 1) {
      const base = prev[mask];
      if (!Number.isFinite(base)) continue;
      const skipCost = base + 200;
      if (skipCost < next[mask]) {
        next[mask] = skipCost;
        pmChoice[mask] = -1;
        fromMask[mask] = mask;
      }
      for (let j = 0; j < m; j += 1) {
        const bit = 1 << j;
        if (mask & bit) continue;
        const between = edgeKm(ams[i], pms[j]);
        if (between == null) continue;
        const nextMask = mask | bit;
        const cost = base + between;
        if (cost < next[nextMask]) {
          next[nextMask] = cost;
          pmChoice[nextMask] = j;
          fromMask[nextMask] = mask;
        }
      }
    }
    prev = next;
    parentPm.push(pmChoice);
    parentMask.push(fromMask);
  }
  let bestMask = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < full; mask += 1) {
    if (prev[mask] < bestCost) {
      bestCost = prev[mask];
      bestMask = mask;
    }
  }
  const pairs: Array<{ am: T; pm: T; between: number }> = [];
  let mask = bestMask;
  for (let i = ams.length - 1; i >= 0; i -= 1) {
    const pmIndex = parentPm[i][mask];
    const from = parentMask[i][mask];
    if (pmIndex >= 0) {
      const between = edgeKm(ams[i], pms[pmIndex]);
      if (between != null) pairs.push({ am: ams[i], pm: pms[pmIndex], between });
    }
    if (from >= 0) mask = from;
  }
  return pairs;
}
