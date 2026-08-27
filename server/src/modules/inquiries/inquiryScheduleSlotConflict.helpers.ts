import type { PrismaClient } from '@prisma/client';
import { isAllDayPreferredTime } from '../../lib/scheduleAllDayTime.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { kstDayRangeYmd } from './inquiryListDateRange.js';
import {
  consumesAfternoonSlot,
  consumesMorningSlot,
} from '../schedule/scheduleSlot.helpers.js';

function isInternalTeamLeaderRole(role: string | null | undefined): boolean {
  return role === 'TEAM_LEADER' || role === 'ADMIN';
}

function internalLeaderIdsFromAssignments(
  assignments: ReadonlyArray<{ teamLeaderId: string; teamLeader: { role: string } }>,
): string[] {
  const ids: string[] = [];
  for (const a of assignments) {
    if (!isInternalTeamLeaderRole(a.teamLeader.role)) continue;
    const id = a.teamLeaderId?.trim();
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * PATCH 후 팀장·시간대·예약일 기준 슬롯 충돌(종일 ↔ 오전/오후/종일) 검증.
 * @returns 오류 문구 또는 null(통과)
 */
export async function assertPatchInquiryScheduleSlotConflict(
  prisma: PrismaClient,
  tenantId: string,
  inquiryId: string,
  preferredDate: Date | null,
  preferredTime: string | null,
  betweenScheduleSlot: string | null,
  teamLeaderIds: string[],
): Promise<string | null> {
  if (!preferredDate) return null;

  const needsMorning = consumesMorningSlot({ preferredTime, betweenScheduleSlot });
  const needsAfternoon = consumesAfternoonSlot({ preferredTime, betweenScheduleSlot });
  if (!needsMorning && !needsAfternoon) return null;

  const leaderIds = [...new Set(teamLeaderIds.map((id) => id.trim()).filter(Boolean))];
  if (leaderIds.length === 0) return null;

  const ymd = dateToYmdKst(preferredDate);
  const range = kstDayRangeYmd(ymd);
  if (!range) return null;

  const siblings = await prisma.inquiry.findMany({
    where: {
      tenantId,
      id: { not: inquiryId },
      preferredDate: { gte: range.gte, lte: range.lte },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      assignments: {
        some: {
          teamLeader: { role: { in: ['TEAM_LEADER', 'ADMIN'] } },
        },
      },
    },
    select: {
      id: true,
      preferredTime: true,
      betweenScheduleSlot: true,
      assignments: {
        select: {
          teamLeaderId: true,
          teamLeader: { select: { role: true } },
        },
      },
    },
  });

  for (const other of siblings) {
    const otherMorning = consumesMorningSlot(other);
    const otherAfternoon = consumesAfternoonSlot(other);
    if (!otherMorning && !otherAfternoon) continue;

    const otherLeaderIds = new Set(internalLeaderIdsFromAssignments(other.assignments));
    for (const leaderId of leaderIds) {
      if (!otherLeaderIds.has(leaderId)) continue;
      if (needsMorning && otherMorning) {
        if (isAllDayPreferredTime(preferredTime) || isAllDayPreferredTime(other.preferredTime)) {
          return '해당 예약일에 선택한 팀장은 이미 종일(또는 같은 시간대) 일정이 있어 배정할 수 없습니다.';
        }
        return '해당 예약일 오전 시간대에 선택한 팀장이 이미 배정되어 있습니다.';
      }
      if (needsAfternoon && otherAfternoon) {
        if (isAllDayPreferredTime(preferredTime) || isAllDayPreferredTime(other.preferredTime)) {
          return '해당 예약일에 선택한 팀장은 이미 종일(또는 같은 시간대) 일정이 있어 배정할 수 없습니다.';
        }
        return '해당 예약일 오후 시간대에 선택한 팀장이 이미 배정되어 있습니다.';
      }
    }
  }

  return null;
}
