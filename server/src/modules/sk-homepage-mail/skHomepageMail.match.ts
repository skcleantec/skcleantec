import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getDefaultOperatingCompanyId } from '../operating-companies/operatingCompany.service.js';
import { notifyLandingContactListRefresh, notifyLandingContactSubmitted } from '../landing-contact/landingContactNotify.js';
import { formatSkHomepageQuote, parseSkHomepageQuote, type SkHomepageQuote } from './skHomepageMail.parse.js';

const HOMEPAGE_MEMO = '옛 홈페이지 간편견적';

function leadValues(quote: SkHomepageQuote): { content: string; customFieldValues: Record<string, string> } {
  const customFieldValues: Record<string, string> = {};
  if (quote.areaPyeong != null) customFieldValues.area_pyeong = String(quote.areaPyeong);
  return {
    content: formatSkHomepageQuote(quote).slice(0, 8000),
    customFieldValues,
  };
}

async function insertLead(
  tx: Prisma.TransactionClient,
  tenantId: string,
  operatingCompanyId: string,
  quote: SkHomepageQuote,
): Promise<{ id: string; customerName: string }> {
  const values = leadValues(quote);
  const row = await tx.landingContactInquiry.create({
    data: {
      tenantId,
      operatingCompanyId,
      customerName: quote.customerName.slice(0, 120),
      customerPhone: quote.customerPhone.slice(0, 40),
      content: values.content,
      customFieldValues: values.customFieldValues,
      source: 'homepage_mail',
      sourceLabel: '홈페이지',
      status: 'NEW',
    },
    select: { id: true, customerName: true },
  });
  return row;
}

export async function matchSkHomepageMail(tenantId: string, mailId: string): Promise<boolean> {
  const mail = await prisma.skHomepageInquiryMail.findFirst({
    where: { id: mailId, tenantId, landingContactId: null, inquiryId: null },
  });
  if (!mail) return false;
  const quote = parseSkHomepageQuote(mail.subject, mail.textBody);
  if (!quote) return false;
  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, tenantId);
  const lead = await prisma.$transaction(async (tx) => {
    const created = await insertLead(tx, tenantId, operatingCompanyId, quote);
    await tx.skHomepageInquiryMail.update({
      where: { id: mail.id },
      data: { landingContactId: created.id, status: 'MATCHED' },
    });
    return created;
  });
  await notifyLandingContactSubmitted({
    tenantId,
    landingContactId: lead.id,
    customerName: lead.customerName,
    summary: `홈페이지 문의: ${lead.customerName.trim() || '고객'}님`,
  });
  return true;
}

/** 이미 서비스접수로 들어간 간편견적만 문의내역으로 옮기고 접수 목록에서는 뺀다. */
export async function relocateSkHomepageInquiriesToLeads(tenantId: string): Promise<number> {
  const mails = await prisma.skHomepageInquiryMail.findMany({
    where: { tenantId, inquiryId: { not: null }, landingContactId: null },
    select: { id: true, subject: true, textBody: true, inquiryId: true },
  });
  let moved = 0;
  for (const mail of mails) {
    if (!mail.inquiryId) continue;
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: mail.inquiryId, tenantId, deletedAt: null },
      select: {
        id: true,
        status: true,
        memo: true,
        operatingCompanyId: true,
        customerName: true,
      },
    });
    if (!inquiry || inquiry.status !== 'PENDING' || inquiry.memo !== HOMEPAGE_MEMO) continue;
    const assigned = await prisma.assignment.count({ where: { inquiryId: inquiry.id, tenantId } });
    if (assigned > 0) continue;
    const quote = parseSkHomepageQuote(mail.subject, mail.textBody);
    if (!quote) continue;
    const operatingCompanyId =
      inquiry.operatingCompanyId ?? (await getDefaultOperatingCompanyId(prisma, tenantId));
    await prisma.$transaction(async (tx) => {
      const created = await insertLead(tx, tenantId, operatingCompanyId, quote);
      await tx.skHomepageInquiryMail.update({
        where: { id: mail.id },
        data: { landingContactId: created.id, inquiryId: null, status: 'MATCHED' },
      });
      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: { deletedAt: new Date() },
      });
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: inquiry.id,
          customerName: inquiry.customerName,
          lines: ['홈페이지 문의를 문의내역으로 옮김'],
        },
      });
    });
    moved += 1;
  }
  if (moved > 0) await notifyLandingContactListRefresh(tenantId);
  return moved;
}
