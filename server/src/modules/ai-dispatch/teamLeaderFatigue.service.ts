import type { PrismaClient } from '@prisma/client';
import { addDaysToKstYmd, kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import type { AiDispatchFatigueBand } from './aiDispatch.constants.js';
import { fixedSlot, haversineKm } from './aiDispatchRules.js';

type Db = PrismaClient;

type PastJob = {
  ymd: string;
  pyeong: number | null;
  isOneRoom: boolean;
  noCrew: boolean;
  lat: number | null;
  lng: number | null;
  slot: ReturnType<typeof fixedSlot>;
};

function workPoints(job: PastJob): number {
  const p = job.pyeong;
  let base = 2;
  if (p == null) base = 2;
  else if (p < 15) base = 1.6;
  else if (p < 25) base = 2.6;
  else if (p < 35) base = 4;
  else base = 6;
  if (job.isOneRoom) base *= 1.4;
  if (job.noCrew) base *= 1.3;
  return base;
}

function bandOf(score: number): AiDispatchFatigueBand {
  if (score < 8) return '좋음';
  if (score < 16) return '보통';
  return '피로';
}

/**
 * 최근 7일(대상일 제외) 작업량 + 집→현장→집 거리. 숫자는 관리 화면·프롬프트용이고 팀장 화면에는 내보내지 않는다.
 */
export async function loadLeaderFatigue(
  db: Db,
  tenantId: string,
  workDate: string,
  leaders: Array<{ id: string; homeLat: number; homeLng: number }>,
): Promise<Map<string, { band: AiDispatchFatigueBand; note: string }>> {
  const out = new Map<string, { band: AiDispatchFatigueBand; note: string }>();
  if (leaders.length === 0) return out;
  const from = addDaysToKstYmd(workDate, -7);
  const to = addDaysToKstYmd(workDate, -1);
  const rangeFrom = kstDayRangeYmd(from);
  const rangeTo = kstDayRangeYmd(to);
  if (!rangeFrom || !rangeTo) return out;

  const rows = await db.assignment.findMany({
    where: {
      tenantId,
      teamLeaderId: { in: leaders.map((l) => l.id) },
      inquiry: {
        tenantId,
        deletedAt: null,
        preferredDate: { gte: rangeFrom.gte, lte: rangeTo.lte },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
    },
    select: {
      teamLeaderId: true,
      noCrewMembers: true,
      inquiry: {
        select: {
          preferredDate: true,
          preferredTime: true,
          areaPyeong: true,
          isOneRoom: true,
          addressGeoLat: true,
          addressGeoLng: true,
        },
      },
    },
  });

  const byLeader = new Map<string, PastJob[]>();
  for (const row of rows) {
    const date = row.inquiry.preferredDate;
    if (!date) continue;
    const ymd = date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const list = byLeader.get(row.teamLeaderId) ?? [];
    list.push({
      ymd,
      pyeong: row.inquiry.areaPyeong,
      isOneRoom: row.inquiry.isOneRoom,
      noCrew: row.noCrewMembers,
      lat: row.inquiry.addressGeoLat,
      lng: row.inquiry.addressGeoLng,
      slot: fixedSlot(row.inquiry.preferredTime),
    });
    byLeader.set(row.teamLeaderId, list);
  }

  const homeOf = new Map(leaders.map((l) => [l.id, l]));
  for (const leader of leaders) {
    const jobs = byLeader.get(leader.id) ?? [];
    let score = 0;
    const byDay = new Map<string, PastJob[]>();
    for (const job of jobs) {
      score += workPoints(job);
      const day = byDay.get(job.ymd) ?? [];
      day.push(job);
      byDay.set(job.ymd, day);
    }
    let travelKm = 0;
    const home = homeOf.get(leader.id);
    if (home) {
      for (const dayJobs of byDay.values()) {
        const am = dayJobs.find((j) => j.slot === 'AM' || j.slot === 'ALL_DAY');
        const pm = dayJobs.find((j) => j.slot === 'PM' || j.slot === 'ALL_DAY');
        const points = [am, pm].filter((j) => j && j.lat != null && j.lng != null) as PastJob[];
        if (points.length === 0) continue;
        let cursor = { lat: home.homeLat, lng: home.homeLng };
        for (const p of points) {
          const next = { lat: p.lat as number, lng: p.lng as number };
          travelKm += haversineKm(cursor, next);
          cursor = next;
        }
        travelKm += haversineKm(cursor, { lat: home.homeLat, lng: home.homeLng });
      }
    }
    score += travelKm / 8;
    const last = [...byDay.keys()].sort().at(-1);
    if (last === to) score *= 1.1;
    else if (last && last < addDaysToKstYmd(workDate, -2)) score *= 0.85;
    const large = jobs.filter((j) => (j.pyeong ?? 0) >= 30).length;
    const oneRooms = jobs.filter((j) => j.isOneRoom).length;
    const noteParts = [`최근 7일 ${jobs.length}건`];
    if (large > 0) noteParts.push(`큰 평수 ${large}건`);
    if (oneRooms > 0) noteParts.push(`원룸 ${oneRooms}건`);
    if (travelKm >= 25) noteParts.push('이동이 긴 편');
    else if (jobs.length === 0) noteParts.push('최근 일정이 적음');
    out.set(leader.id, { band: bandOf(score), note: noteParts.join(' · ') });
  }
  return out;
}
