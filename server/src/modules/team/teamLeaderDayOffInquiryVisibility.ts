import type { Prisma, PrismaClient } from '@prisma/client';
import { kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import { dateToYmdKst } from '../users/userEmployment.js';

type DayOffRangeOpts = {
  preferredDateGte?: Date;
  preferredDateLte?: Date;
};

/** 팀장조정(관리 스케줄)으로 슬롯에서 뺀 날 — 팀장 휴무 달력에는 표시하지 않음 */
export async function whereExcludeAdminSlotAdjustInquiries(
  prisma: PrismaClient,
  teamLeaderId: string,
  opts?: DayOffRangeOpts,
): Promise<Prisma.InquiryWhereInput | null> {
  const dayOffWhere: Prisma.UserDayOffWhereInput = {
    teamLeaderId,
    adminSlotAdjust: true,
  };
  if (opts?.preferredDateGte != null || opts?.preferredDateLte != null) {
    dayOffWhere.date = {};
    if (opts.preferredDateGte != null) dayOffWhere.date.gte = opts.preferredDateGte;
    if (opts.preferredDateLte != null) dayOffWhere.date.lte = opts.preferredDateLte;
  }

  const offs = await prisma.userDayOff.findMany({
    where: dayOffWhere,
    select: { date: true },
  });
  if (offs.length === 0) return null;

  const dayRanges = offs
    .map((off) => kstDayRangeYmd(dateToYmdKst(off.date)))
    .filter((r): r is NonNullable<typeof r> => r != null);
  if (dayRanges.length === 0) return null;

  return {
    NOT: {
      OR: dayRanges.map((bounds) => ({
        preferredDate: { gte: bounds.gte, lte: bounds.lte },
      })),
    },
  };
}

export async function isInquiryHiddenFromTeamLeaderByAdminSlotAdjust(
  prisma: PrismaClient,
  teamLeaderId: string,
  preferredDate: Date | null | undefined,
): Promise<boolean> {
  if (!preferredDate) return false;
  const bounds = kstDayRangeYmd(dateToYmdKst(preferredDate));
  if (!bounds) return false;
  const off = await prisma.userDayOff.findFirst({
    where: {
      teamLeaderId,
      adminSlotAdjust: true,
      date: { gte: bounds.gte, lte: bounds.lte },
    },
    select: { teamLeaderId: true },
  });
  return Boolean(off);
}

export async function mergeTeamLeaderVisibleInquiryWhere(
  prisma: PrismaClient,
  teamLeaderId: string,
  where: Prisma.InquiryWhereInput,
  opts?: DayOffRangeOpts,
): Promise<Prisma.InquiryWhereInput> {
  const exclude = await whereExcludeAdminSlotAdjustInquiries(prisma, teamLeaderId, opts);
  if (!exclude) return where;
  return { AND: [where, exclude] };
}
