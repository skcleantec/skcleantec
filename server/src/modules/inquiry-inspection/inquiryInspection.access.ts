import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

export async function findInquiryForTeamLeader(params: {
  inquiryId: string;
  teamLeaderId: string;
  tenantId: string;
}) {
  return prisma.inquiry.findFirst({
    where: {
      id: params.inquiryId,
      tenantId: params.tenantId,
      assignments: { some: { teamLeaderId: params.teamLeaderId } },
    },
    select: {
      id: true,
      tenantId: true,
      customerName: true,
      preferredDate: true,
      roomCount: true,
      isOneRoom: true,
      kitchenCount: true,
      bathroomCount: true,
      status: true,
    },
  });
}

export async function findInquiryForStaff(params: {
  inquiryId: string;
  tenantId: string;
  user: AuthPayload;
}) {
  const { inquiryId, tenantId, user } = params;
  if (user.role === 'ADMIN' || user.role === 'MARKETER') {
    return prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      select: { id: true, tenantId: true },
    });
  }
  return null;
}
