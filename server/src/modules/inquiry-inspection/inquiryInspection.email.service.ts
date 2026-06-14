import { isSmtpConfigured, sendMail } from '../../lib/mailer.js';
import { buildInspectionReportHtml, buildInspectionReportPlainText } from './inquiryInspection.report.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

export async function sendInspectionCompletionEmail(params: {
  row: ChecklistRow;
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  };
  tenantDisplayName: string;
  pdfBuffer: Buffer | null;
  pdfUrl: string | null;
}): Promise<boolean> {
  const email = params.row.customerEmail?.trim();
  if (!email) return false;
  if (!isSmtpConfigured()) {
    console.warn('[inspection-email] SMTP not configured — skip send to', email);
    return false;
  }

  const subject = `[${params.tenantDisplayName}] ${params.inquiry.customerName}님 현장 검수 체크리스트 완료본`;
  const plain = buildInspectionReportPlainText(params.row, params.inquiry);
  const htmlBody = buildInspectionReportHtml(params.row, params.inquiry);
  const pdfLinkBlock = params.pdfUrl
    ? `<p style="margin-top:16px;"><a href="${params.pdfUrl}">완료본 PDF 다운로드</a></p>`
    : '';

  const html = `${htmlBody.replace('</body>', `${pdfLinkBlock}</body>`)}`;

  const attachments =
    params.pdfBuffer && params.pdfBuffer.length > 0
      ? [
          {
            filename: `현장검수_${params.inquiry.customerName.slice(0, 20)}.pdf`,
            content: params.pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      : undefined;

  await sendMail({
    to: email,
    subject,
    html,
    text: plain + (params.pdfUrl ? `\n\nPDF: ${params.pdfUrl}` : ''),
    attachments,
  });
  return true;
}
