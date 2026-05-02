import type { PrismaClient } from '@prisma/client';

export async function listPayrollAdminPersonalExpensesForMonth(
  prismaClient: PrismaClient,
  monthKey: string,
) {
  return prismaClient.payrollAdminPersonalExpense.findMany({
    where: { monthKey },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      monthKey: true,
      amount: true,
      memo: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createPayrollAdminPersonalExpense(
  prismaClient: PrismaClient,
  params: { monthKey: string; amount: number; memo: string | null; createdById: string },
) {
  return prismaClient.payrollAdminPersonalExpense.create({
    data: {
      monthKey: params.monthKey,
      amount: params.amount,
      memo: params.memo,
      createdById: params.createdById,
    },
    select: {
      id: true,
      monthKey: true,
      amount: true,
      memo: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deletePayrollAdminPersonalExpenseById(
  prismaClient: PrismaClient,
  expenseId: string,
): Promise<boolean> {
  try {
    await prismaClient.payrollAdminPersonalExpense.delete({ where: { id: expenseId } });
    return true;
  } catch {
    return false;
  }
}
