import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { MANUAL_INTAKE_PLACEHOLDER_ADDRESS } from '../../lib/orderFormPendingAddress.js';
import { createInquiryFromBody, InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import {
  formatCustomFieldsForInquiryMemo,
  parseLandingContactCustomFields,
} from './landingContactForm.schema.js';

const LANDING_INQUIRY_SOURCE = '랜딩문의';

export async function convertLandingContactToInquiry(params: {
  tenantId: string;
  landingContactId: string;
  userId: string;
  userRole: UserRole;
}): Promise<{ inquiryId: string }> {
  const row = await prisma.landingContactInquiry.findFirst({
    where: { id: params.landingContactId, tenantId: params.tenantId },
    include: {
      operatingCompany: { select: { id: true, name: true } },
    },
  });
  if (!row) {
    throw new InquiryCreateError('문의를 찾을 수 없습니다.', 404);
  }
  if (row.inquiryId) {
    throw new InquiryCreateError('이미 접수로 전환된 문의입니다.');
  }
  if (row.status === 'CLOSED') {
    throw new InquiryCreateError('종료된 문의는 접수로 전환할 수 없습니다.');
  }

  const config = await prisma.landingContactFormConfig.findFirst({
    where: { tenantId: params.tenantId, operatingCompanyId: row.operatingCompanyId },
    select: { customFields: true },
  });
  const customFields = parseLandingContactCustomFields(config?.customFields);
  const customValues =
    row.customFieldValues && typeof row.customFieldValues === 'object' && !Array.isArray(row.customFieldValues)
      ? (row.customFieldValues as Record<string, string>)
      : {};
  const customMemo = formatCustomFieldsForInquiryMemo(customFields, customValues);
  const memoParts = [row.content.trim()];
  if (customMemo) memoParts.push(customMemo);
  if (row.sourcePageUrl?.trim()) memoParts.push(`유입: ${row.sourcePageUrl.trim()}`);

  const created = await createInquiryFromBody({
    tenantId: params.tenantId,
    userId: params.userId,
    userRole: params.userRole,
    body: {
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      address: MANUAL_INTAKE_PLACEHOLDER_ADDRESS,
      status: 'PENDING',
      source: LANDING_INQUIRY_SOURCE,
      operatingCompanyId: row.operatingCompanyId,
      memo: memoParts.filter(Boolean).join('\n\n'),
    },
  });

  await prisma.landingContactInquiry.update({
    where: { id: row.id },
    data: {
      inquiryId: created.id,
      status: 'CONVERTED',
      convertedById: params.userId,
      convertedAt: new Date(),
    },
  });

  return { inquiryId: created.id };
}
