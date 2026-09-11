import { prisma } from '../../lib/prisma.js';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';
import {
  resolveInquiryNaviDestination,
  type InquiryNaviDestinationDto,
} from '../inquiries/inquiryNaviDestination.service.js';
import { isInquiryHiddenFromTeamLeaderByAdminSlotAdjust } from './teamLeaderDayOffInquiryVisibility.js';

export type TeamNaviDestinationDto = InquiryNaviDestinationDto;

export async function resolveTeamNaviDestination(opts: {
  tenantId: string;
  userId: string;
  inquiryId: string;
}): Promise<{ ok: true; data: TeamNaviDestinationDto } | { ok: false; status: 404 | 422; error: string }> {
  const row = await prisma.inquiry.findFirst({
    where: {
      id: opts.inquiryId,
      tenantId: opts.tenantId,
      ...inquiryActiveOnlyWhere(),
      assignments: { some: { teamLeaderId: opts.userId } },
    },
    select: {
      id: true,
      preferredDate: true,
    },
  });
  if (!row) {
    return { ok: false, status: 404, error: '담당 접수를 찾을 수 없습니다.' };
  }
  if (await isInquiryHiddenFromTeamLeaderByAdminSlotAdjust(prisma, opts.userId, row.preferredDate)) {
    return { ok: false, status: 404, error: '담당 접수를 찾을 수 없습니다.' };
  }

  return resolveInquiryNaviDestination({ tenantId: opts.tenantId, inquiryId: row.id });
}
