import type { PrismaClient } from '@prisma/client';

export async function listPayrollIncomeDepositsForMonth(prismaClient: PrismaClient, monthKey: string) {
  return prismaClient.payrollIncomeDeposit.findMany({
    where: { monthKey },
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
    monthKey: string;
    depositedOn: Date;
    amount: number;
    memo: string | null;
    createdById: string;
  },
) {
  return prismaClient.payrollIncomeDeposit.create({
    data: {
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
  depositId: string,
): Promise<boolean> {
  try {
    await prismaClient.payrollIncomeDeposit.delete({ where: { id: depositId } });
    return true;
  } catch {
    return false;
  }
}
