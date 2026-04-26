import { prisma } from '../../lib/prisma.js';
import { preferredDateYmdKst } from '../inquiries/crewMemberCapacity.helpers.js';
import { getDayRosterInRange } from '../team-crew-groups/crewGroupDayRoster.service.js';

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
  status: string;
  leaders: CrewFieldLeaderOut[];
};

export type CrewFieldMemberDayOut = {
  teamMemberId: string;
  name: string;
  onRoster: boolean;
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
): Promise<{ useDailyRosterOnly: boolean; days: CrewFieldDayOut[] }> {
  const group = await prisma.teamCrewGroup.findUnique({
    where: { id: groupId },
    select: {
      useDailyRosterOnly: true,
      members: {
        include: {
          teamMember: { select: { id: true, name: true, isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!group) {
    throw new Error('CREW_GROUP_NOT_FOUND');
  }

  const rosterItems = await getDayRosterInRange(groupId, startYmd, endYmd);
  const rosterByYmd = new Map<string, Set<string>>();
  for (const it of rosterItems) {
    rosterByYmd.set(it.date, new Set(it.teamMemberIds));
  }

  const rangeGte = new Date(`${startYmd}T00:00:00.000+09:00`);
  const rangeLte = new Date(`${endYmd}T23:59:59.999+09:00`);

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

  const inquiriesByYmd = new Map<string, typeof inquiries>();
  for (const q of inquiries) {
    const ymd = preferredDateYmdKst(q.preferredDate);
    if (!ymd) continue;
    if (!inquiriesByYmd.has(ymd)) inquiriesByYmd.set(ymd, []);
    inquiriesByYmd.get(ymd)!.push(q);
  }

  const nameToMemberIdsInGroup = (name: string): string[] => {
    const t = name.trim();
    return group.members.filter((m) => m.teamMember.name.trim() === t).map((m) => m.teamMemberId);
  };

  const days: CrewFieldDayOut[] = [];

  for (const ymd of eachYmdInRange(startYmd, endYmd)) {
    const rosterSet = rosterByYmd.get(ymd) ?? new Set<string>();
    const dayInquiries = inquiriesByYmd.get(ymd) ?? [];

    const memberIdsForDay = new Set<string>();
    if (group.useDailyRosterOnly) {
      for (const id of rosterSet) memberIdsForDay.add(id);
    } else {
      for (const gm of group.members) {
        if (gm.teamMember.isActive) memberIdsForDay.add(gm.teamMemberId);
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
        matched.push({
          inquiryId: inq.id,
          inquiryNumber: inq.inquiryNumber,
          customerName: inq.customerName,
          address: inq.address,
          preferredTime: inq.preferredTime,
          status: inq.status,
          leaders: inq.assignments.map((a) => ({
            id: a.teamLeader.id,
            name: a.teamLeader.name,
            role: a.teamLeader.role,
            vehicleNumber: a.teamLeader.vehicleNumber,
            externalCompanyName: a.teamLeader.externalCompany?.name ?? null,
          })),
        });
      }

      members.push({
        teamMemberId: mid,
        name: gm.teamMember.name,
        onRoster: group.useDailyRosterOnly ? onRoster : true,
        inquiries: matched,
      });
    }

    members.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    if (members.length > 0) {
      days.push({ date: ymd, members });
    }
  }

  return { useDailyRosterOnly: group.useDailyRosterOnly, days };
}
