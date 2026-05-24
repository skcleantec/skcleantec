import type { PrismaClient } from '@prisma/client';

export async function listPayrollAdminPersonalExpensesForMonth(
  prismaClient: PrismaClient,
  tenantId: string,
  monthKey: string,
) {
  return prismaClient.payrollAdminPersonalExpense.findMany({
    where: { tenantId, monthKey },
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
  params: { tenantId: string; monthKey: string; amount: number; memo: string | null; createdById: string },
) {
  return prismaClient.payrollAdminPersonalExpense.create({
    data: {
      tenantId: params.tenantId,
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
  tenantId: string,
  expenseId: string,
): Promise<boolean> {
  try {
    const result = await prismaClient.payrollAdminPersonalExpense.deleteMany({
      where: { id: expenseId, tenantId },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}
