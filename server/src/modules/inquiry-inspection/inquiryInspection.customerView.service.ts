import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateInspectionCustomerViewToken } from './inquiryInspection.token.js';

export class InspectionPublicError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'InspectionPublicError';
  }
}

export async function ensureInspectionCustomerViewToken(
  db: PrismaClient,
  checklistId: string,
  tenantId: string,
): Promise<string> {
  const row = await db.inquiryInspectionChecklist.findFirst({
    where: { id: checklistId, tenantId, status: 'COMPLETED' },
    select: { customerViewToken: true },
  });
  if (!row) {
    throw new InspectionPublicError('완료된 검수본을 찾을 수 없습니다.', 404);
  }
  if (row.customerViewToken) return row.customerViewToken;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateInspectionCustomerViewToken();
    try {
      await db.inquiryInspectionChecklist.update({
        where: { id: checklistId },
        data: { customerViewToken: token },
      });
      return token;
    } catch {
      // unique collision — retry
    }
  }
  throw new InspectionPublicError('고객 링크를 발급하지 못했습니다.', 500);
}

export async function findCompletedInspectionByCustomerViewToken(token: string) {
  return prisma.inquiryInspectionChecklist.findFirst({
    where: { customerViewToken: token, status: 'COMPLETED' },
    select: {
      id: true,
      tenantId: true,
      status: true,
      completedAt: true,
      inquiry: {
        select: {
          customerName: true,
          preferredDate: true,
          inquiryNumber: true,
          operatingCompany: { select: { slug: true } },
        },
      },
    },
  });
}
