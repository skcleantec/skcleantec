import type { PrismaClient, TeamLeaderSizePolicy } from '@prisma/client';
import { kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import { isUserEmployedOnYmd } from '../users/userEmployment.js';
import { AI_DISPATCH_DEFAULTS, type AiDispatchFatigueBand, type AiDispatchSlot } from './aiDispatch.constants.js';
import {
  areaLabel,
  fixedSlot,
  requiredLeaderCount,
  sizePolicyAllows,
  slotJobWeight,
} from './aiDispatchRules.js';
import { loadLeaderFatigue } from './teamLeaderFatigue.service.js';

type Db = PrismaClient;

export type DispatchSettings = {
  extraLeaderMinPyeong: number;
  extraLeaderCount: number;
  twoRoomMaxPyeong: number;
  includeCrewInFatigue: boolean;
};

export type DispatchLeader = {
  id: string;
  name: string;
  jobsPerDay: 1 | 2;
  sizePolicy: TeamLeaderSizePolicy;
  homeLat: number;
  homeLng: number;
  band: AiDispatchFatigueBand;
  fatigue: number;
  note: string;
  usedJobs: number;
  remainingJobs: number;
};

export type DispatchJob = {
  id: string;
  customerName: string;
  areaLabel: string;
  lat: number | null;
  lng: number | null;
  pyeong: number | null;
  isOneRoom: boolean;
  slot: AiDispatchSlot;
  requiredLeaders: number;
  updatedAt: string;
  preferredTime: string | null;
  blockedReason: string | null;
};

export async function loadDispatchSettings(db: Db, tenantId: string): Promise<DispatchSettings> {
  const row = await db.tenantAiDispatchSettings.findUnique({ where: { tenantId } });
  return {
    extraLeaderMinPyeong: row?.extraLeaderMinPyeong ?? AI_DISPATCH_DEFAULTS.extraLeaderMinPyeong,
    extraLeaderCount: row?.extraLeaderCount ?? AI_DISPATCH_DEFAULTS.extraLeaderCount,
    twoRoomMaxPyeong: row?.twoRoomMaxPyeong ?? AI_DISPATCH_DEFAULTS.twoRoomMaxPyeong,
    includeCrewInFatigue: row?.includeCrewInFatigue ?? AI_DISPATCH_DEFAULTS.includeCrewInFatigue,
  };
}

export async function loadDispatchDay(db: Db, tenantId: string, workDate: string) {
  const range = kstDayRangeYmd(workDate);
  if (!range) return null;
  const settings = await loadDispatchSettings(db, tenantId);
  const dayDate = new Date(`${workDate}T12:00:00+09:00`);

  const [users, offRows, inquiries] = await Promise.all([
    db.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', isActive: true },
      select: {
        id: true,
        name: true,
        hireDate: true,
        resignationDate: true,
        homeGeoLat: true,
        homeGeoLng: true,
        dispatchProfile: { select: { jobsPerDay: true, sizePolicy: true } },
      },
    }),
    db.userDayOff.findMany({
      where: { date: dayDate, teamLeader: { tenantId } },
      select: { teamLeaderId: true },
    }),
    db.inquiry.findMany({
      where: {
        tenantId,
        deletedAt: null,
        preferredDate: { gte: range.gte, lte: range.lte },
        status: { in: ['RECEIVED', 'ASSIGNED'] },
        tenantShareAsTarget: null,
      },
      select: {
        id: true,
        customerName: true,
        address: true,
        addressGeoLat: true,
        addressGeoLng: true,
        areaPyeong: true,
        isOneRoom: true,
        preferredTime: true,
        betweenScheduleSlot: true,
        status: true,
        updatedAt: true,
        assignments: { select: { teamLeaderId: true, teamLeader: { select: { role: true } } } },
      },
    }),
  ]);

  const off = new Set(offRows.map((r) => r.teamLeaderId));
  const homeReady = users.filter(
    (u) =>
      isUserEmployedOnYmd(u.hireDate, u.resignationDate, workDate) &&
      !off.has(u.id) &&
      u.homeGeoLat != null &&
      u.homeGeoLng != null,
  );

  const used = new Map<string, number>();
  for (const inquiry of inquiries) {
    if (inquiry.status !== 'ASSIGNED' && inquiry.assignments.length === 0) continue;
    const weight = slotJobWeight(fixedSlot(inquiry.preferredTime, inquiry.betweenScheduleSlot));
    for (const a of inquiry.assignments) {
      if (a.teamLeader.role !== 'TEAM_LEADER') continue;
      used.set(a.teamLeaderId, (used.get(a.teamLeaderId) ?? 0) + weight);
    }
  }

  const fatigue = await loadLeaderFatigue(
    db,
    tenantId,
    workDate,
    homeReady.map((u) => ({ id: u.id, homeLat: u.homeGeoLat as number, homeLng: u.homeGeoLng as number })),
    settings.includeCrewInFatigue,
  );

  const leaders: DispatchLeader[] = homeReady.map((u) => {
    const jobsPerDay = u.dispatchProfile?.jobsPerDay === 1 ? 1 : 2;
    const usedJobs = used.get(u.id) ?? 0;
    const fatigueRow = fatigue.get(u.id) ?? { band: '좋음' as const, fatigue: 1, note: '최근 일정이 적음' };
    return {
      id: u.id,
      name: u.name,
      jobsPerDay,
      sizePolicy: u.dispatchProfile?.sizePolicy ?? 'UNRESTRICTED',
      homeLat: u.homeGeoLat as number,
      homeLng: u.homeGeoLng as number,
      band: fatigueRow.band,
      fatigue: fatigueRow.fatigue,
      note: fatigueRow.note,
      usedJobs,
      remainingJobs: Math.max(0, jobsPerDay - usedJobs),
    };
  });

  const jobs: DispatchJob[] = [];
  for (const inquiry of inquiries) {
    const external = inquiry.assignments.some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
    if (external || inquiry.assignments.length > 0 || inquiry.status !== 'RECEIVED') continue;
    const slot = fixedSlot(inquiry.preferredTime, inquiry.betweenScheduleSlot);
    let blockedReason: string | null = null;
    if (slot === 'HUMAN') blockedReason = '오전·오후가 정해지지 않아 사람이 정합니다.';
    else if (inquiry.addressGeoLat == null || inquiry.addressGeoLng == null) {
      blockedReason = '현장 좌표가 없어 동선을 계산할 수 없습니다.';
    }
    jobs.push({
      id: inquiry.id,
      customerName: inquiry.customerName,
      areaLabel: areaLabel(inquiry.address),
      lat: inquiry.addressGeoLat,
      lng: inquiry.addressGeoLng,
      pyeong: inquiry.areaPyeong,
      isOneRoom: inquiry.isOneRoom,
      slot,
      requiredLeaders: requiredLeaderCount(inquiry.areaPyeong, settings),
      updatedAt: inquiry.updatedAt.toISOString(),
      preferredTime: inquiry.preferredTime,
      blockedReason,
    });
  }

  for (const job of jobs) {
    if (job.blockedReason) continue;
    if (leadersForJob(leaders, job, settings.twoRoomMaxPyeong).length === 0) {
      job.blockedReason = '이 시간대에 남은 건수가 있는 팀장이 없습니다.';
    }
  }

  return { settings, leaders, jobs };
}

export function leadersForJob(leaders: DispatchLeader[], job: DispatchJob, twoRoomMax: number): DispatchLeader[] {
  if (job.slot === 'HUMAN' || job.blockedReason) return [];
  const weight = slotJobWeight(job.slot);
  return leaders.filter(
    (leader) =>
      leader.remainingJobs >= weight &&
      (job.slot !== 'ALL_DAY' || leader.jobsPerDay >= 2) &&
      sizePolicyAllows(leader.sizePolicy, { isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax),
  );
}
