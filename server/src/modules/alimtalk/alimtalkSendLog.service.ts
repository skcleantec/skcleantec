import { prisma } from '../../lib/prisma.js';
import type { AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import { maskAlimtalkPhone } from './alimtalkPhone.js';

export type AlimtalkSendLogListItem = {
  id: string;
  createdAt: string;
  templateCode: string;
  inquiryId: string | null;
  inquiryNumber: string | null;
  customerName: string | null;
  preferredDateYmd: string | null;
  toPhone: string;
  status: 'success' | 'failed' | 'pending';
  deliveredChannel: string | null;
  errorMessage: string | null;
};

function mapSendLogStatus(row: {
  chargeStatus: string;
  errorMessage: string | null;
  deliveredChannel: string | null;
}): AlimtalkSendLogListItem['status'] {
  if (row.chargeStatus === 'FAILED') return 'failed';
  if (row.chargeStatus === 'PENDING') return 'pending';
  if (row.chargeStatus === 'FREE' || row.chargeStatus === 'PAID') return 'success';
  return 'failed';
}

function formatPreferredDateYmd(preferredDate: Date | null): string | null {
  if (!preferredDate) return null;
  return preferredDate.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export async function listAlimtalkSendLogsForTenantAdmin(params: {
  tenantId: string;
  templateCode?: AlimtalkTemplateCode;
  limit?: number;
  offset?: number;
}): Promise<{ items: AlimtalkSendLogListItem[]; total: number }> {
  const templateCode = params.templateCode ?? 'CBISEO_CUST_SCHEDULE_D2';
  const limit = Math.min(100, Math.max(1, params.limit ?? 30));
  const offset = Math.max(0, params.offset ?? 0);

  const where = { tenantId: params.tenantId, templateCode };

  const [total, rows] = await Promise.all([
    prisma.alimtalkSendLog.count({ where }),
    prisma.alimtalkSendLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        templateCode: true,
        inquiryId: true,
        toPhone: true,
        chargeStatus: true,
        deliveredChannel: true,
        errorMessage: true,
      },
    }),
  ]);

  const inquiryIds = rows.map((r) => r.inquiryId).filter((id): id is string => Boolean(id));
  const inquiries =
    inquiryIds.length > 0
      ? await prisma.inquiry.findMany({
          where: { id: { in: inquiryIds }, tenantId: params.tenantId },
          select: {
            id: true,
            inquiryNumber: true,
            customerName: true,
            preferredDate: true,
          },
        })
      : [];
  const inquiryMap = new Map(inquiries.map((i) => [i.id, i]));

  const items: AlimtalkSendLogListItem[] = rows.map((row) => {
    const inquiry = row.inquiryId ? inquiryMap.get(row.inquiryId) : undefined;
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      templateCode: row.templateCode,
      inquiryId: row.inquiryId,
      inquiryNumber: inquiry?.inquiryNumber ?? null,
      customerName: inquiry?.customerName ?? null,
      preferredDateYmd: formatPreferredDateYmd(inquiry?.preferredDate ?? null),
      toPhone: maskAlimtalkPhone(row.toPhone),
      status: mapSendLogStatus(row),
      deliveredChannel: row.deliveredChannel,
      errorMessage: row.errorMessage,
    };
  });

  return { items, total };
}
