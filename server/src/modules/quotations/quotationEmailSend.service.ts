import { prisma } from '../../lib/prisma.js';
import { getTenantCompanyProfile } from '../tenants/tenantCompanyProfile.service.js';
import { sendQuotationEmail } from './quotation.email.service.js';
import { getOrCreateQuotationConfig } from './quotationConfig.service.js';
import {
  buildQuotationEmailContent,
  previewBodyForLog,
} from './quotationEmailContent.service.js';
import { generateAndStoreQuotationPdf } from './quotationPdfBuild.service.js';
import {
  quotationInclude,
  serializeQuotation,
  type QuotationRow,
} from './quotations.service.js';
import { resolveQuotationBrandDisplayName } from './quotationDocumentTitle.service.js';

export type QuotationEmailSendInput = {
  tenantId: string;
  userId: string;
  quotationId: string;
  to: string;
  subject?: string | null;
  body?: string | null;
};

export type QuotationEmailSendResult =
  | { ok: true; quotation: ReturnType<typeof serializeQuotation> }
  | { ok: false; status: number; error: string };

export async function executeQuotationEmailSend(
  input: QuotationEmailSendInput,
): Promise<QuotationEmailSendResult> {
  const row = await prisma.quotation.findFirst({
    where: { id: input.quotationId, tenantId: input.tenantId },
    include: quotationInclude,
  });
  if (!row) {
    return { ok: false, status: 404, error: '견적서를 찾을 수 없습니다.' };
  }

  const profile = await getTenantCompanyProfile(input.tenantId);
  const companyName =
    resolveQuotationBrandDisplayName(
      row.operatingCompany,
      profile.companyRegistration.companyName,
    ) || '견적서';
  const config = await getOrCreateQuotationConfig(prisma, input.tenantId);
  const { subject, body } = buildQuotationEmailContent({
    quotation: row,
    companyName,
    config,
    subjectOverride: input.subject,
    bodyOverride: input.body,
  });

  let pdfBuffer: Buffer;
  try {
    const built = await generateAndStoreQuotationPdf(prisma, input.quotationId, input.tenantId);
    pdfBuffer = built.buffer;
  } catch {
    return { ok: false, status: 500, error: 'PDF 생성에 실패했습니다.' };
  }

  const now = new Date();
  let sent = false;
  let errorMessage: string | null = null;

  try {
    sent = await sendQuotationEmail({
      tenantId: input.tenantId,
      quotation: row,
      to: input.to,
      subject,
      body,
      pdfBuffer,
    });
    if (!sent) {
      errorMessage = 'SMTP가 설정되지 않았습니다.';
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : '이메일 발송에 실패했습니다.';
  }

  await prisma.quotationEmailLog.create({
    data: {
      tenantId: input.tenantId,
      quotationId: row.id,
      to: input.to,
      subject,
      bodyPreview: previewBodyForLog(body),
      sentById: input.userId,
      sentAt: now,
      success: sent,
      errorMessage,
    },
  });

  if (!sent) {
    return {
      ok: false,
      status: 503,
      error:
        errorMessage ??
        'SMTP가 설정되지 않았습니다. 업체등록정보에서 메일 설정을 확인해주세요.',
    };
  }

  const updated = await prisma.quotation.update({
    where: { id: row.id },
    data: {
      status: 'SENT',
      customerEmail: input.to,
      lastEmailedAt: now,
      ...(row.sentAt ? {} : { sentAt: now }),
    },
    include: quotationInclude,
  });

  return { ok: true, quotation: serializeQuotation(updated) };
}

export async function buildQuotationEmailDefaultsForRow(
  tenantId: string,
  row: QuotationRow,
): Promise<{ subject: string; body: string }> {
  const profile = await getTenantCompanyProfile(tenantId);
  const companyName =
    resolveQuotationBrandDisplayName(
      row.operatingCompany,
      profile.companyRegistration.companyName,
    ) || '견적서';
  const config = await getOrCreateQuotationConfig(prisma, tenantId);
  return buildQuotationEmailContent({ quotation: row, companyName, config });
}
