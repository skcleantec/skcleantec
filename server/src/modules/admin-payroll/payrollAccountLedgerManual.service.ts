import type {
  PrismaClient,
  PayrollAccountLedgerManualDirection,
  PayrollLedgerManualPayrollLinkKind,
} from '@prisma/client';

export async function createPayrollAccountLedgerManualEntry(
  prismaClient: PrismaClient,
  params: {
    monthKey: string;
    direction: PayrollAccountLedgerManualDirection;
    occurredOn: Date;
    accountLabel: string;
    amount: number;
    memo: string | null;
    createdById: string;
    payrollLinkKind: PayrollLedgerManualPayrollLinkKind;
    linkTeamMemberId: string | null;
    linkUserId: string | null;
    linkExternalCompanyId: string | null;
  },
) {
  return prismaClient.payrollAccountLedgerManualEntry.create({
    data: {
      monthKey: params.monthKey,
      direction: params.direction,
      occurredOn: params.occurredOn,
      accountLabel: params.accountLabel,
      amount: params.amount,
      memo: params.memo,
      createdById: params.createdById,
      payrollLinkKind: params.payrollLinkKind,
      linkTeamMemberId: params.linkTeamMemberId,
      linkUserId: params.linkUserId,
      linkExternalCompanyId: params.linkExternalCompanyId,
    },
    select: {
      id: true,
      monthKey: true,
      direction: true,
      occurredOn: true,
      accountLabel: true,
      amount: true,
      memo: true,
      payrollLinkKind: true,
      linkTeamMemberId: true,
      linkUserId: true,
      linkExternalCompanyId: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      linkTeamMember: { select: { id: true, name: true } },
      linkUser: { select: { id: true, name: true, role: true } },
      linkExternalCompany: { select: { id: true, name: true } },
    },
  });
}

export async function deletePayrollAccountLedgerManualEntryById(
  prismaClient: PrismaClient,
  entryId: string,
): Promise<boolean> {
  try {
    await prismaClient.payrollAccountLedgerManualEntry.delete({ where: { id: entryId } });
    return true;
  } catch {
    return false;
  }
}
