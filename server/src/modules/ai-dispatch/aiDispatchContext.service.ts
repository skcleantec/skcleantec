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
  normalWorkDaysPerWeek: number;
  normalJobsPerWeek: number;
};

export type DispatchLeader = {
  id: string;
  name: string;
  jobsPerDay: 1 | 2;
  sizePolicy: TeamLeaderSizePolicy;
  homeAddress: string;
  homeAddressDetail: string;
  homeLat: number;
  homeLng: number;
  band: AiDispatchFatigueBand;
  fatigue: number;
  note: string;
  usedJobs: number;
  remainingJobs: number;
  detail: {
    windowDays: number;
    workedDays: number;
    jobCount: number;
    restDays: number;
    sinceRest: boolean;
    normalWorkDays: number;
    normalJobs: number;
    loopKm: number | null;
    teamLoopKm: number | null;
    betweenDeltaKm: number | null;
    distanceSinceRestKm: number | null;
    largeJobs: number;
    soloJobs: number;
  };
};

export type DispatchManualJob = {
  id: string;
  customerName: string;
  areaLabel: string;
  pyeong: number | null;
  lat: number | null;
  lng: number | null;
  slot: AiDispatchSlot;
  teamLeaderId: string;
  teamLeaderName: string;
};

export type DispatchJob = {
  id: string;
  customerName: string;
  areaLabel: string;
  lat: number | null;
  lng: number | null;
  pyeong: number | null;
  isOneRoom: boolean;
  tone: 'GOOD' | 'NORMAL' | 'BAD' | 'SEVERE' | 'ELDERLY';
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
    normalWorkDaysPerWeek: row?.normalWorkDaysPerWeek ?? AI_DISPATCH_DEFAULTS.normalWorkDaysPerWeek,
    normalJobsPerWeek: row?.normalJobsPerWeek ?? AI_DISPATCH_DEFAULTS.normalJobsPerWeek,
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
        homeAddress: true,
        homeAddressDetail: true,
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
        internalCustomerTone: true,
        preferredTime: true,
        betweenScheduleSlot: true,
        status: true,
        updatedAt: true,
        assignments: { select: { teamLeaderId: true, teamLeader: { select: { role: true, name: true } } } },
        tenantSharesAsSource: { select: { syncStatus: true } },
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
    settings.normalWorkDaysPerWeek,
    settings.normalJobsPerWeek,
    settings.twoRoomMaxPyeong,
  );

  const leaders: DispatchLeader[] = homeReady.map((u) => {
    const jobsPerDay = u.dispatchProfile?.jobsPerDay === 1 ? 1 : 2;
    const usedJobs = used.get(u.id) ?? 0;
    const fatigueRow = fatigue.get(u.id) ?? {
      band: '좋음' as const,
      fatigue: 1,
      note: '최근 일정이 적음',
      detail: {
        windowDays: 7,
        workedDays: 0,
        jobCount: 0,
        restDays: 0,
        sinceRest: false,
        normalWorkDays: settings.normalWorkDaysPerWeek,
        normalJobs: settings.normalJobsPerWeek,
        loopKm: null,
        teamLoopKm: null,
        betweenDeltaKm: null,
        distanceSinceRestKm: null,
        largeJobs: 0,
        soloJobs: 0,
      },
    };
    return {
      id: u.id,
      name: u.name,
      jobsPerDay,
      sizePolicy: u.dispatchProfile?.sizePolicy ?? 'UNRESTRICTED',
      homeAddress: u.homeAddress ?? '',
      homeAddressDetail: u.homeAddressDetail ?? '',
      homeLat: u.homeGeoLat as number,
      homeLng: u.homeGeoLng as number,
      band: fatigueRow.band,
      fatigue: fatigueRow.fatigue,
      note: fatigueRow.note,
      usedJobs,
      remainingJobs: Math.max(0, jobsPerDay - usedJobs),
      detail: fatigueRow.detail,
    };
  });

  const jobs: DispatchJob[] = [];
  const manualJobs: DispatchManualJob[] = [];
  for (const inquiry of inquiries) {
    const external = inquiry.assignments.some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
    const handedToPartner = inquiry.tenantSharesAsSource.some((share) => share.syncStatus === 'ACTIVE');
    if (external || handedToPartner) continue;
    const slot = fixedSlot(inquiry.preferredTime, inquiry.betweenScheduleSlot);
    const ownLeaders = inquiry.assignments.filter((a) => a.teamLeader.role === 'TEAM_LEADER');
    if (ownLeaders.length > 0) {
      for (const row of ownLeaders) {
        manualJobs.push({
          id: inquiry.id,
          customerName: inquiry.customerName,
          areaLabel: areaLabel(inquiry.address),
          pyeong: inquiry.areaPyeong,
          lat: inquiry.addressGeoLat,
          lng: inquiry.addressGeoLng,
          slot,
          teamLeaderId: row.teamLeaderId,
          teamLeaderName: row.teamLeader.name,
        });
      }
      continue;
    }
    if (inquiry.status !== 'RECEIVED') continue;
    const blockedReason = leaders.length === 0 ? '넣을 팀장이 없습니다.' : null;
    jobs.push({
      id: inquiry.id,
      customerName: inquiry.customerName,
      areaLabel: areaLabel(inquiry.address),
      lat: inquiry.addressGeoLat,
      lng: inquiry.addressGeoLng,
      pyeong: inquiry.areaPyeong,
      isOneRoom: inquiry.isOneRoom,
      tone: inquiry.internalCustomerTone,
      slot,
      requiredLeaders: requiredLeaderCount(inquiry.areaPyeong, settings),
      updatedAt: inquiry.updatedAt.toISOString(),
      preferredTime: inquiry.preferredTime,
      blockedReason,
    });
  }

  return { settings, leaders, jobs, manualJobs };
}

export function leadersForJob(leaders: DispatchLeader[], job: DispatchJob, twoRoomMax: number): DispatchLeader[] {
  const sized = leaders.filter((leader) =>
    sizePolicyAllows(leader.sizePolicy, { isOneRoom: job.isOneRoom, areaPyeong: job.pyeong }, twoRoomMax),
  );
  if (job.slot !== 'ALL_DAY') return sized;
  return sized.filter((leader) => leader.jobsPerDay >= 2);
}
