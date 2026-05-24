import type { PrismaClient } from '@prisma/client';

export async function listPayrollIncomeDepositsForMonth(
  prismaClient: PrismaClient,
  tenantId: string,
  monthKey: string,
) {
  return prismaClient.payrollIncomeDeposit.findMany({
    where: { tenantId, monthKey },
    orderBy: [{ depositedOn: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      monthKey: true,
      depositedOn: true,
      amount: true,
      memo: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createPayrollIncomeDeposit(
  prismaClient: PrismaClient,
  params: {
    tenantId: string;
    monthKey: string;
    depositedOn: Date;
    amount: number;
    memo: string | null;
    createdById: string;
  },
) {
  return prismaClient.payrollIncomeDeposit.create({
    data: {
      tenantId: params.tenantId,
      monthKey: params.monthKey,
      depositedOn: params.depositedOn,
      amount: params.amount,
      memo: params.memo,
      createdById: params.createdById,
    },
    select: {
      id: true,
      monthKey: true,
      depositedOn: true,
      amount: true,
      memo: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deletePayrollIncomeDepositById(
  prismaClient: PrismaClient,
  tenantId: string,
  depositId: string,
): Promise<boolean> {
  try {
    const result = await prismaClient.payrollIncomeDeposit.deleteMany({
      where: { id: depositId, tenantId },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}
