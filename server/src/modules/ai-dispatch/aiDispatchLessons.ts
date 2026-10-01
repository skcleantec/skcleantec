import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { haversineKm, fixedSlot } from './aiDispatchRules.js';
import type { DispatchLeader } from './aiDispatchContext.service.js';

type Db = PrismaClient;

const HISTORY_FRESH_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;
const CORRECTION_KEEP = 40;

function kmBetween(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return Math.round(haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function ymdKst(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

async function upsertLesson(db: Db, tenantId: string, kind: 'CORRECTION' | 'HISTORY', fingerprint: string, text: string) {
  const body = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!body) return;
  await db.aiDispatchLesson.upsert({
    where: { tenantId_fingerprint: { tenantId, fingerprint } },
    create: { id: randomUUID(), tenantId, kind, fingerprint, text: body },
    update: { kind, text: body },
  });
}

async function trimCorrections(db: Db, tenantId: string) {
  const stale = await db.aiDispatchLesson.findMany({
    where: { tenantId, kind: 'CORRECTION' },
    orderBy: { updatedAt: 'desc' },
    skip: CORRECTION_KEEP,
    select: { id: true },
  });
  if (stale.length === 0) return;
  await db.aiDispatchLesson.deleteMany({ where: { tenantId, id: { in: stale.map((row) => row.id) } } });
}

export async function loadDispatchLessons(db: Db, tenantId: string): Promise<string[]> {
  const [history, corrections] = await Promise.all([
    db.aiDispatchLesson.findMany({
      where: { tenantId, kind: 'HISTORY' },
      orderBy: { fingerprint: 'asc' },
      select: { text: true },
    }),
    db.aiDispatchLesson.findMany({
      where: { tenantId, kind: 'CORRECTION' },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: { text: true },
    }),
  ]);
  return [...history.map((row) => row.text), ...corrections.map((row) => row.text)];
}

/** 지난 실제 배정의 오전·오후 거리와 집 거리를 문장으로 갱신한다. 고객 이름은 넣지 않는다. */
export async function ensureDispatchHistoryLessons(db: Db, tenantId: string) {
  const fresh = await db.aiDispatchLesson.findFirst({
    where: { tenantId, kind: 'HISTORY' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  if (fresh && Date.now() - fresh.updatedAt.getTime() < HISTORY_FRESH_MS) return;

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.assignment.findMany({
    where: {
      tenantId,
      inquiry: {
        tenantId,
        status: { in: ['ASSIGNED', 'COMPLETED'] },
        preferredDate: { gte: since },
      },
    },
    select: {
      teamLeaderId: true,
      inquiry: {
        select: {
          preferredDate: true,
          preferredTime: true,
          betweenScheduleSlot: true,
          addressGeoLat: true,
          addressGeoLng: true,
        },
      },
      teamLeader: { select: { homeGeoLat: true, homeGeoLng: true } },
    },
    take: 8000,
  });

  const pairKm: number[] = [];
  const homeKm: number[] = [];
  const byLeaderDay = new Map<string, { am: Array<{ lat: number; lng: number }>; pm: Array<{ lat: number; lng: number }> }>();
  for (const row of rows) {
    const date = row.inquiry.preferredDate;
    if (!date) continue;
    const slot = fixedSlot(row.inquiry.preferredTime, row.inquiry.betweenScheduleSlot);
    const lat = row.inquiry.addressGeoLat;
    const lng = row.inquiry.addressGeoLng;
    if ((slot === 'AM' || slot === 'PM') && lat != null && lng != null) {
      const key = `${ymdKst(date)}:${row.teamLeaderId}`;
      const bag = byLeaderDay.get(key) ?? { am: [], pm: [] };
      bag[slot === 'AM' ? 'am' : 'pm'].push({ lat, lng });
      byLeaderDay.set(key, bag);
      if (slot === 'AM') {
        const fromHome = kmBetween(
          { lat: row.teamLeader.homeGeoLat, lng: row.teamLeader.homeGeoLng },
          { lat, lng },
        );
        if (fromHome != null) homeKm.push(fromHome);
      }
    }
  }
  for (const bag of byLeaderDay.values()) {
    let best: number | null = null;
    for (const am of bag.am) {
      for (const pm of bag.pm) {
        const between = kmBetween(am, pm);
        if (between == null) continue;
        if (best == null || between < best) best = between;
      }
    }
    if (best != null) pairKm.push(best);
  }

  const pairMedian = median(pairKm);
  const homeMedian = median(homeKm);
  if (pairMedian == null || pairKm.length < 8) {
    await db.aiDispatchLesson.deleteMany({ where: { tenantId, fingerprint: 'history:ampm' } });
  } else {
    const far = pairKm.filter((value) => value > Math.max(pairMedian * 3, 20)).length;
    const farShare = Math.round((far / pairKm.length) * 100);
    await upsertLesson(
      db,
      tenantId,
      'HISTORY',
      'history:ampm',
      `지난 90일 실제 배정에서 같은 팀장의 오전·오후 직선거리 중앙값은 ${pairMedian}km입니다. 그 세 배를 넘는 짝은 ${farShare}%입니다. 가까운 짝이 있으면 그보다 먼 짝을 만들지 마세요.`,
    );
  }
  if (homeMedian == null || homeKm.length < 8) {
    await db.aiDispatchLesson.deleteMany({ where: { tenantId, fingerprint: 'history:home' } });
  } else {
    await upsertLesson(
      db,
      tenantId,
      'HISTORY',
      'history:home',
      `지난 90일 실제 배정에서 오전 현장은 팀장 집에서 중앙 ${homeMedian}km였습니다. 집에서 훨씬 먼 오전은 컨디션이 더 좋은 팀장에게 두세요.`,
    );
  }
}

export async function rememberDispatchCorrection(
  db: Db,
  tenantId: string,
  input: {
    inquiryId: string;
    aiLeaderId: string | null;
    nextLeaderId: string | null;
    slot: string;
    isOneRoom: boolean;
    lat: number | null;
    lng: number | null;
    leaders: DispatchLeader[];
    siblingStops: Array<{ teamLeaderId: string | null; slot: string; lat: number | null; lng: number | null }>;
  },
) {
  const fromId = input.aiLeaderId;
  const toId = input.nextLeaderId;
  if (fromId === toId) {
    await db.aiDispatchLesson.deleteMany({ where: { tenantId, fingerprint: `corr:${input.inquiryId}` } });
    return;
  }
  const slotName = input.slot === 'AM' ? '오전' : input.slot === 'PM' ? '오후' : input.slot === 'ALL_DAY' ? '종일' : '일정';
  const label = input.isOneRoom ? `원·투룸 체크 ${slotName}` : slotName;
  const from = input.leaders.find((leader) => leader.id === fromId);
  const to = input.leaders.find((leader) => leader.id === toId);
  const job = { lat: input.lat, lng: input.lng };
  const bits = !fromId && toId
    ? [`관리자가 팀장 없이 둔 ${label}에 팀장을 넣었습니다. 같은 상황이면 비우지 마세요.`]
    : toId
      ? [`관리자가 AI가 넣은 ${label} 팀장을 다른 팀장으로 바꿨습니다. 그 배정은 틀린 것으로 보세요.`]
      : [`관리자가 AI가 넣은 ${label} 팀장을 빼 비워 두었습니다. 같은 상황이면 팀장 없이 두세요.`];
  if (from && to) {
    const fromHome = kmBetween({ lat: from.homeLat, lng: from.homeLng }, job);
    const toHome = kmBetween({ lat: to.homeLat, lng: to.homeLng }, job);
    if (fromHome != null && toHome != null) bits.push(`집은 AI 팀장 ${fromHome}km, 바꾼 팀장 ${toHome}km입니다.`);
  }
  const opposite = input.siblingStops.find(
    (stop) => stop.teamLeaderId === fromId && stop.slot !== input.slot && (stop.slot === 'AM' || stop.slot === 'PM'),
  );
  const beforePair = opposite ? kmBetween(opposite, job) : null;
  const nextOpposite = input.siblingStops.find(
    (stop) => stop.teamLeaderId === toId && stop.slot !== input.slot && (stop.slot === 'AM' || stop.slot === 'PM'),
  );
  const afterPair = nextOpposite ? kmBetween(nextOpposite, job) : null;
  if (beforePair != null && afterPair != null && afterPair + 1 < beforePair) {
    bits.push(`오전·오후는 ${beforePair}km에서 ${afterPair}km로 줄었습니다. 다음에도 더 가까운 짝을 고르세요.`);
  }
  await upsertLesson(db, tenantId, 'CORRECTION', `corr:${input.inquiryId}`, bits.join(' '));
  await trimCorrections(db, tenantId);
}
