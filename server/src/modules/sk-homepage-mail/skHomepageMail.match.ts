import { prisma } from '../../lib/prisma.js';
import { createInquiryFromBody } from '../inquiries/inquiryCreate.service.js';
import { allocateNextInquiryNumber } from '../inquiries/inquiryNumber.js';
import { parseSkHomepageQuote } from './skHomepageMail.parse.js';

export async function matchSkHomepageMail(tenantId: string, mailId: string): Promise<boolean> {
  const mail = await prisma.skHomepageInquiryMail.findFirst({
    where: { id: mailId, tenantId, inquiryId: null },
  });
  if (!mail) return false;
  const quote = parseSkHomepageQuote(mail.subject, mail.textBody);
  if (!quote) return false;

  const created = await createInquiryFromBody({
    tenantId,
    userRole: 'ADMIN',
    body: {
      status: 'PENDING',
      source: '홈페이지',
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      address: quote.address,
      areaPyeong: quote.areaPyeong,
      areaBasis: quote.areaPyeong != null ? '공급' : null,
      roomCount: quote.roomCount,
      bathroomCount: quote.bathroomCount,
      balconyCount: quote.balconyCount,
      preferredDate: quote.preferredDate,
      specialNotes: quote.specialNotes || null,
      memo: '옛 홈페이지 간편견적',
    },
  });

  const owned = await prisma.inquiry.findFirst({
    where: { id: created.id, tenantId },
    select: { id: true, inquiryNumber: true, operatingCompanyId: true, customerName: true },
  });
  if (!owned) return false;

  await prisma.$transaction(async (tx) => {
    const inquiryNumber =
      owned.inquiryNumber ??
      (await allocateNextInquiryNumber(tx, tenantId, owned.operatingCompanyId));
    await tx.inquiry.update({
      where: { id: owned.id },
      data: {
        inquiryNumber,
        kitchenCount: quote.kitchenCount,
        moveInDate: quote.moveInDate ? new Date(`${quote.moveInDate}T12:00:00+09:00`) : null,
        moveInTiming: quote.moveInDate ? 'PLANNED' : null,
      },
    });
    await tx.inquiryChangeLog.create({
      data: {
        inquiryId: owned.id,
        customerName: owned.customerName,
        lines: ['옛 홈페이지 간편견적 메일'],
      },
    });
    await tx.skHomepageInquiryMail.update({
      where: { id: mail.id },
      data: { inquiryId: owned.id, status: 'MATCHED' },
    });
  });
  return true;
}
