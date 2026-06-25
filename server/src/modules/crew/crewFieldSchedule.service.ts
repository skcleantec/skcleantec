import { prisma } from '../../lib/prisma.js';
import { isCrewGroupRosterMode } from '../../lib/crewGroupSettings.js';
import { preferredDateYmdKst } from '../inquiries/crewMemberCapacity.helpers.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { getDayRosterInRange } from '../team-crew-groups/crewGroupDayRoster.service.js';
import { effectiveCrewMeetingTimeForDisplay } from '../inquiries/crewMeetingTime.helpers.js';
import { resolveMemberMeetingTimeRaw } from '../inquiries/inquiryCrewMemberMeetingTime.service.js';

const NOTE_SPLIT = /[,·/|]/g;

function parseCrewMemberNoteToNames(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(NOTE_SPLIT)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** startYmd ~ endYmd (포함), 한국 날짜 기준 연속 일자 (서버 TZ와 무관) */
export function* eachYmdInRange(startYmd: string, endYmd: string): Generator<string> {
  let t = new Date(`${startYmd}T12:00:00+09:00`).getTime();
  const endT = new Date(`${endYmd}T12:00:00+09:00`).getTime();
  const dayMs = 86400000;
  for (; t <= endT; t += dayMs) {
    yield new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  }
}

export type CrewFieldLeaderOut = {
  id: string;
  name: string;
  /** 로마자 표기 — 크루 일정 표 배정 팀장 옆 표시 */
  nameEn: string | null;
  role: string;
  vehicleNumber: string | null;
  externalCompanyName: string | null;
};

export type CrewFieldInquiryOut = {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  address: string;
  preferredTime: string | null;
  /** 팀장 지정 크루 미팅(HH:mm). 오전 희망일 때만 의미 있음 */
  crewMeetingTime: string | null;
  /** 팀장이 미팅 시각을 저장한 적 있음 — 크루 UI 태국어 «수정됨» 등 */
  crewMeetingTimeEdited: boolean;
  status: string;
  leaders: CrewFieldLeaderOut[];
};

export type CrewFieldMemberDayOut = {
  teamMemberId: string;
  name: string;
  nameTh: string | null;
  onRoster: boolean;
  /** 일할 명단 + 크루장 「대기」 — 접수 없을 때 현장 일정 미팅 칸 표시용 */
  isStandby: boolean;
  inquiries: CrewFieldInquiryOut[];
};

export type CrewFieldDayOut = {
  date: string;
  members: CrewFieldMemberDayOut[];
};

export async function buildCrewFieldSchedule(
  groupId: string,
  startYmd: string,
  endYmd: string
): Promise<{ useDailyRosterOnly: boolean; availabilityMode: 'ROSTER' | 'DAY_OFF'; days: CrewFieldDayOut[] }> {
  const group = await prisma.teamCrewGroup.findUnique({
    where: { id: groupId },
    select: {
      availabilityMode: true,
      members: {
        include: {
          teamMember: { select: { id: true, name: true, nameTh: true, isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!group) {
    throw new Error('CREW_GROUP_NOT_FOUND');
  }
  const rosterMode = isCrewGroupRosterMode(group.availabilityMode);

  const rosterItems = await getDayRosterInRange(groupId, startYmd, endYmd);
  const rosterByYmd = new Map<string, Set<string>>();
  const standbyByYmd = new Map<string, Set<string>>();
  for (const it of rosterItems) {
    rosterByYmd.set(it.date, new Set(it.teamMemberIds));
    standbyByYmd.set(it.date, new Set(it.standbyTeamMemberIds));
  }

  const rangeGte = new Date(`${startYmd}T00:00:00.000+09:00`);
  const rangeLte = new Date(`${endYmd}T23:59:59.999+09:00`);

  const dayOffByYmd = new Map<string, Set<string>>();
  if (!rosterMode) {
    const memberIds = group.members.map((m) => m.teamMemberId);
    if (memberIds.length > 0) {
      const offRows = await prisma.teamMemberDayOff.findMany({
        where: {
          teamMemberId: { in: memberIds },
          date: { gte: rangeGte, lte: rangeLte },
        },
        select: { teamMemberId: true, date: true },
      });
      for (const row of offRows) {
        const k = dateToYmdKst(row.date);
        if (!dayOffByYmd.has(k)) dayOffByYmd.set(k, new Set());
        dayOffByYmd.get(k)!.add(row.teamMemberId);
      }
    }
  }

  const inquiries = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: rangeGte, lte: rangeLte },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
    },
    select: {
      id: true,
      inquiryNumber: true,
      customerName: true,
      address: true,
      preferredDate: true,
      preferredTime: true,
      betweenScheduleSlot: true,
      crewMeetingTime: true,
      crewMeetingTimeShared: true,
      crewMeetingTimeUpdatedAt: true,
      crewMemberMeetingTimes: { select: { teamMemberId: true, meetingTime: true } },
      status: true,
      crewMemberNote: true,
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: {
          teamLeader: {
            select: {
              id: true,
              name: true,
              role: true,
              vehicleNumber: true,
              externalCompany: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  /** `users.name_en` 미마이그레이션 DB 호환 — 조회 실패 시 빈 맵 */
  let leaderNameEnById = new Map<string, string | null>();
  try {
    const leaderIds = [...new Set(inquiries.flatMap((q) => q.assignments.map((a) => a.teamLeader.id)))];
    if (leaderIds.length > 0) {
      const rows = await prisma.user.findMany({
        where: { id: { in: leaderIds } },
        select: { id: true, nameEn: true },
      });
      leaderNameEnById = new Map(rows.map((r) => [r.id, r.nameEn]));
    }
  } catch {
    leaderNameEnById = new Map();
  }

  const inquiriesByYmd = new Map<string, typeof inquiries>();
  for (const q of inquiries) {
    const ymd = preferredDateYmdKst(q.preferredDate);
    if (!ymd) continue;
    if (!inquiriesByYmd.has(ymd)) inquiriesByYmd.set(ymd, []);
    inquiriesByYmd.get(ymd)!.push(q);
  }

  const nameToMemberIdsInGroup = (name: string): string[] => {
    const t = name.trim();
    return group.members
      .filter((m) => {
        const ko = m.teamMember.name.trim();
        const th = (m.teamMember.nameTh ?? '').trim();
        return ko === t || (th.length > 0 && th === t);
      })
      .map((m) => m.teamMemberId);
  };

  const days: CrewFieldDayOut[] = [];

  for (const ymd of eachYmdInRange(startYmd, endYmd)) {
    const rosterSet = rosterByYmd.get(ymd) ?? new Set<string>();
    const standbySet = standbyByYmd.get(ymd) ?? new Set<string>();
    const dayInquiries = inquiriesByYmd.get(ymd) ?? [];

    const memberIdsForDay = new Set<string>();
    if (rosterMode) {
      for (const id of rosterSet) memberIdsForDay.add(id);
    } else {
      const offSet = dayOffByYmd.get(ymd) ?? new Set<string>();
      for (const gm of group.members) {
        if (gm.teamMember.isActive && !offSet.has(gm.teamMemberId)) {
          memberIdsForDay.add(gm.teamMemberId);
        }
      }
    }

    for (const inq of dayInquiries) {
      for (const n of parseCrewMemberNoteToNames(inq.crewMemberNote)) {
        for (const mid of nameToMemberIdsInGroup(n)) {
          memberIdsForDay.add(mid);
        }
      }
    }

    const members: CrewFieldMemberDayOut[] = [];
    for (const mid of memberIdsForDay) {
      const gm = group.members.find((x) => x.teamMemberId === mid);
      if (!gm) continue;
      const onRoster = rosterSet.has(mid);

      const matched: CrewFieldInquiryOut[] = [];
      for (const inq of dayInquiries) {
        const names = parseCrewMemberNoteToNames(inq.crewMemberNote);
        if (!names.some((n) => nameToMemberIdsInGroup(n).includes(mid))) continue;
        const rawMeeting = resolveMemberMeetingTimeRaw(
          inq.crewMeetingTimeShared !== false,
          inq.crewMeetingTime,
          mid,
          inq.crewMemberMeetingTimes,
        );
        const effMeeting = effectiveCrewMeetingTimeForDisplay(
          inq.preferredTime,
          inq.betweenScheduleSlot,
          rawMeeting,
        );
        matched.push({
          inquiryId: inq.id,
          inquiryNumber: inq.inquiryNumber,
          customerName: inq.customerName,
          address: inq.address,
          preferredTime: inq.preferredTime,
          crewMeetingTime: effMeeting,
          crewMeetingTimeEdited: Boolean(inq.crewMeetingTimeUpdatedAt) && Boolean(effMeeting),
          status: inq.status,
          leaders: inq.assignments.map((a) => ({
            id: a.teamLeader.id,
            name: a.teamLeader.name,
            /** DB `users.name_en` 반영 후 Prisma select에 `nameEn` 포함 가능 */
            nameEn: null as string | null,
            role: a.teamLeader.role,
            vehicleNumber: a.teamLeader.vehicleNumber,
            externalCompanyName: a.teamLeader.externalCompany?.name ?? null,
          })),
        });
      }

      members.push({
        teamMemberId: mid,
        name: gm.teamMember.name,
        nameTh: gm.teamMember.nameTh,
        onRoster: rosterMode ? onRoster : true,
        isStandby: standbySet.has(mid),
        inquiries: matched,
      });
    }

    members.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    if (members.length > 0) {
      days.push({ date: ymd, members });
    }
  }

  return { useDailyRosterOnly: rosterMode, availabilityMode: group.availabilityMode, days };
}

/** 홈 월별 막대그래프 — 현장 일정과 동일: 취소·보류 제외 접수 + `crewMemberNote` 이름 매칭 건만 집계 */
export async function getCrewMonthlyInquiryStats(
  groupId: string,
  monthKey: string
): Promise<{
  month: string;
  useDailyRosterOnly: boolean;
  items: Array<{
    teamMemberId: string;
    name: string;
    nameTh: string | null;
    isActive: boolean;
    inquiryCount: number;
  }>;
} | null> {
  const range = kstMonthRangeYm(monthKey);
  if (!range) return null;

  const startYmd = dateToYmdKst(range.gte);
  const endYmd = dateToYmdKst(range.lte);

  let built: { useDailyRosterOnly: boolean; days: CrewFieldDayOut[] };
  try {
    built = await buildCrewFieldSchedule(groupId, startYmd, endYmd);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'CREW_GROUP_NOT_FOUND') return null;
    throw e;
  }

  const group = await prisma.teamCrewGroup.findUnique({
    where: { id: groupId },
    select: {
      members: {
        include: {
          teamMember: { select: { id: true, name: true, nameTh: true, isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!group) return null;

  const counts = new Map<string, number>();
  for (const day of built.days) {
    for (const m of day.members) {
      const n = m.inquiries.length;
      if (n > 0) counts.set(m.teamMemberId, (counts.get(m.teamMemberId) ?? 0) + n);
    }
  }

  const items = group.members.map((gm) => ({
    teamMemberId: gm.teamMemberId,
    name: gm.teamMember.name,
    nameTh: gm.teamMember.nameTh,
    isActive: gm.teamMember.isActive,
    inquiryCount: counts.get(gm.teamMemberId) ?? 0,
  }));

  return { month: monthKey, useDailyRosterOnly: built.useDailyRosterOnly, items };
}
