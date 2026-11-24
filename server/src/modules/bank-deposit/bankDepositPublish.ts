import { Prisma, type PrismaClient } from '@prisma/client';
import { notifyBankDeposit } from './bankDepositNotify.js';
import { notifyStaffOfNewBankDeposit } from './bankDepositStaffPush.service.js';
import { followupMarketerName, inquiryMarketerName } from './bankDepositView.js';

type Db = PrismaClient | Prisma.TransactionClient;

async function depositNotifyNames(
  db: Db,
  tenantId: string,
  input: { operatingCompanyId: string | null; linkedInquiryId: string | null; linkedFollowupId: string | null },
) {
  const [brand, inquiry, followup] = await Promise.all([
    input.operatingCompanyId
      ? db.operatingCompany.findFirst({
          where: { id: input.operatingCompanyId, tenantId },
          select: { name: true },
        })
      : null,
    input.linkedInquiryId
      ? db.inquiry.findFirst({
          where: { id: input.linkedInquiryId, tenantId },
          select: {
            customerName: true,
            createdBy: { select: { name: true } },
            orderForm: { select: { createdBy: { select: { name: true } } } },
          },
        })
      : null,
    !input.linkedInquiryId && input.linkedFollowupId
      ? db.orderFollowup.findFirst({
          where: { id: input.linkedFollowupId, tenantId },
          select: {
            customerName: true,
            createdBy: { select: { name: true } },
            handledBy: { select: { name: true } },
          },
        })
      : null,
  ]);
  return {
    operatingCompanyName: brand?.name?.trim() || null,
    customerName: inquiry?.customerName?.trim() || followup?.customerName?.trim() || null,
    marketerName: inquiry
      ? inquiryMarketerName(inquiry.createdBy?.name, inquiry.orderForm?.createdBy?.name)
      : followup
        ? followupMarketerName(followup.handledBy?.name, followup.createdBy?.name)
        : null,
  };
}

export async function publishBankDeposit(
  db: Db,
  row: {
    tenantId: string;
    event: 'new' | 'changed';
    id: string;
    status: string;
    amountWon: number;
    depositorName: string;
    operatingCompanyId: string | null;
    linkedInquiryId: string | null;
    linkedFollowupId: string | null;
    linkedKind: string | null;
    noOwner?: boolean;
    claimedByTeamLeaderName?: string | null;
  },
) {
  const stored = await db.bankDeposit.findFirst({
    where: { id: row.id, tenantId: row.tenantId },
    select: { source: true, depositedAt: true },
  });
  const names = await depositNotifyNames(db, row.tenantId, row);
  notifyBankDeposit({
    tenantId: row.tenantId,
    event: row.event,
    id: row.id,
    status: row.status,
    amountWon: row.amountWon,
    depositorName: row.depositorName,
    operatingCompanyId: row.operatingCompanyId,
    operatingCompanyName: names.operatingCompanyName,
    customerName: names.customerName,
    marketerName: names.marketerName,
    linkedInquiryId: row.linkedInquiryId,
    linkedKind: row.linkedKind,
    noOwner: row.noOwner,
    claimedByTeamLeaderName: row.claimedByTeamLeaderName,
    source: stored?.source === 'scan' || stored?.source === 'notification' ? stored.source : 'sms',
  });
  if (row.event === 'new' && stored) {
    try {
      await notifyStaffOfNewBankDeposit(db, {
        tenantId: row.tenantId,
        depositId: row.id,
        event: 'new',
        source: stored.source,
        depositedAt: stored.depositedAt,
        status: row.status,
        amountWon: row.amountWon,
        depositorName: row.depositorName,
        brandName: names.operatingCompanyName,
        customerName: names.customerName,
        marketerName: names.marketerName,
        linkedKind: row.linkedKind,
      });
    } catch {
      console.warn('[bank-deposit] staff push skipped');
    }
  }
}
