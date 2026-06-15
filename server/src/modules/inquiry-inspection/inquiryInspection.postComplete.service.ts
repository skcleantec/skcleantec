import { prisma } from '../../lib/prisma.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';
import { buildInspectionPdfBuffer } from './inquiryInspection.pdf.service.js';
import { uploadInspectionPdfBuffer } from './inquiryInspection.pdfUpload.service.js';
import { sendInspectionCompletionEmail } from './inquiryInspection.email.service.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { formatSmtpSendError } from '../../lib/tenantSmtp.service.js';
import { ensureInspectionCustomerViewToken } from './inquiryInspection.customerView.service.js';
import { buildInspectionCustomerViewUrl } from './inquiryInspection.publicUrl.js';

/** 검수 완료 직후 PDF 생성·Cloudinary 저장·고객 이메일 발송 */
export async function finalizeInspectionAfterComplete(params: {
  checklistId: string;
  tenantId: string;
  inquiryId: string;
}): Promise<void> {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId, inquiryId: params.inquiryId },
    include: inspectionChecklistInclude,
  });
  if (!row) return;

  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: {
      customerName: true,
      inquiryNumber: true,
      preferredDate: true,
      address: true,
      addressDetail: true,
      operatingCompany: { select: { slug: true } },
    },
  });
  if (!inquiry) return;

  const address = [inquiry.address, inquiry.addressDetail].filter(Boolean).join(' ');
  const inquiryPayload = {
    customerName: inquiry.customerName,
    inquiryNumber: inquiry.inquiryNumber,
    preferredDate: inquiry.preferredDate,
    address,
  };

  let pdfBuffer: Buffer | null = null;
  let pdfPublicId: string | null = row.completionPdfPublicId;
  let pdfUrl: string | null = row.completionPdfSecureUrl;

  try {
    pdfBuffer = await buildInspectionPdfBuffer(row, inquiryPayload);
    if (isCloudinaryConfigured() && pdfBuffer.length > 0) {
      const up = await uploadInspectionPdfBuffer({
        inquiryId: params.inquiryId,
        checklistId: row.id,
        buffer: pdfBuffer,
      });
      pdfPublicId = up.publicId;
      pdfUrl = up.secureUrl;
      await prisma.inquiryInspectionChecklist.update({
        where: { id: row.id },
        data: {
          completionPdfPublicId: pdfPublicId,
          completionPdfSecureUrl: pdfUrl,
        },
      });
    }
  } catch (e) {
    console.error('[inspection-finalize] PDF generation/upload failed', e);
  }

  const tenantConfig = await getTenantConfig(params.tenantId);
  const tenantDisplayName =
    (typeof tenantConfig.branding?.displayName === 'string' && tenantConfig.branding.displayName.trim()) ||
    '청소비서';

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { slug: true },
  });

  let customerViewUrl: string | null = null;
  try {
    const viewToken = await ensureInspectionCustomerViewToken(prisma, row.id, params.tenantId);
    customerViewUrl = buildInspectionCustomerViewUrl(viewToken, {
      tenantSlug: tenantRow?.slug ?? null,
      brandSlug: inquiry.operatingCompany?.slug ?? null,
    });
  } catch (e) {
    console.error('[inspection-finalize] customer view token failed', e);
  }

  let emailSent = false;
  try {
    emailSent = await sendInspectionCompletionEmail({
      tenantId: params.tenantId,
      row,
      inquiry: inquiryPayload,
      tenantDisplayName,
      pdfBuffer,
      pdfUrl,
      customerViewUrl,
    });
  } catch (e) {
    console.error('[inspection-finalize] email send failed', formatSmtpSendError(e), e);
  }

  if (emailSent) {
    await prisma.inquiryInspectionChecklist.update({
      where: { id: row.id },
      data: { emailSentAt: new Date() },
    });
  }
}

export async function resendInspectionCompletionEmail(params: {
  checklistId: string;
  tenantId: string;
  inquiryId: string;
}): Promise<{ emailSent: boolean; pdfUrl: string | null }> {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId, inquiryId: params.inquiryId },
    include: inspectionChecklistInclude,
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (row.status !== 'COMPLETED') {
    throw Object.assign(new Error('not_completed'), { code: 'bad_request' as const });
  }

  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: {
      customerName: true,
      inquiryNumber: true,
      preferredDate: true,
      address: true,
      addressDetail: true,
      operatingCompany: { select: { slug: true } },
    },
  });
  if (!inquiry) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });

  const address = [inquiry.address, inquiry.addressDetail].filter(Boolean).join(' ');
  const inquiryPayload = {
    customerName: inquiry.customerName,
    inquiryNumber: inquiry.inquiryNumber,
    preferredDate: inquiry.preferredDate,
    address,
  };

  let pdfBuffer: Buffer | null = null;
  let pdfUrl = row.completionPdfSecureUrl;

  if (pdfUrl) {
    try {
      const res = await fetch(pdfUrl);
      if (res.ok) pdfBuffer = Buffer.from(await res.arrayBuffer());
    } catch {
      pdfBuffer = null;
    }
  }
  if (!pdfBuffer) {
    try {
      pdfBuffer = await buildInspectionPdfBuffer(row, inquiryPayload);
    } catch (e) {
      console.error('[inspection-resend] PDF generation failed — mail will send with links only', e);
      pdfBuffer = null;
    }
  }

  const tenantConfig = await getTenantConfig(params.tenantId);
  const tenantDisplayName =
    (typeof tenantConfig.branding?.displayName === 'string' && tenantConfig.branding.displayName.trim()) ||
    '청소비서';

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { slug: true },
  });
  let customerViewUrl: string | null = null;
  try {
    const viewToken = await ensureInspectionCustomerViewToken(prisma, row.id, params.tenantId);
    customerViewUrl = buildInspectionCustomerViewUrl(viewToken, {
      tenantSlug: tenantRow?.slug ?? null,
      brandSlug: inquiry.operatingCompany?.slug ?? null,
    });
  } catch (e) {
    console.error('[inspection-resend] customer view token failed', e);
  }

  const emailSent = await sendInspectionCompletionEmail({
    tenantId: params.tenantId,
    row,
    inquiry: inquiryPayload,
    tenantDisplayName,
    pdfBuffer,
    pdfUrl,
    customerViewUrl,
  });

  if (emailSent) {
    await prisma.inquiryInspectionChecklist.update({
      where: { id: row.id },
      data: { emailSentAt: new Date() },
    });
  }

  return { emailSent, pdfUrl };
}
