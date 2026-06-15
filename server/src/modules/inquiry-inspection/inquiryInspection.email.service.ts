import { sendMailForTenant, isSmtpConfiguredForTenant, formatSmtpSendError } from '../../lib/tenantSmtp.service.js';
import { buildInspectionReportHtml, buildInspectionReportPlainText } from './inquiryInspection.report.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

const GMAIL_SAFE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function assertCustomerEmail(row: ChecklistRow): string {
  const email = row.customerEmail?.trim() ?? '';
  if (!email) {
    throw Object.assign(new Error('no_customer_email'), {
      code: 'no_customer_email' as const,
      message: '완료본 수신 이메일이 비어 있습니다. 현장검수 화면에서 고객 이메일을 입력·저장한 뒤 다시 시도해 주세요.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('invalid_customer_email'), {
      code: 'invalid_customer_email' as const,
      message: '완료본 수신 이메일 형식이 올바르지 않습니다. 현장검수에서 이메일을 수정해 주세요.',
    });
  }
  return email;
}

export async function sendInspectionCompletionEmail(params: {
  tenantId: string;
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
  customerViewUrl?: string | null;
}): Promise<boolean> {
  const email = assertCustomerEmail(params.row);
  if (!(await isSmtpConfiguredForTenant(params.tenantId))) {
    throw Object.assign(new Error('smtp_not_configured'), {
      code: 'smtp_not_configured' as const,
      message: 'SMTP가 설정되지 않았습니다. 업체등록정보에서 SMTP를 설정해 주세요.',
    });
  }

  const subject = `[${params.tenantDisplayName}] ${params.inquiry.customerName}님 현장 검수 체크리스트 완료본`;
  const plain = buildInspectionReportPlainText(params.row, params.inquiry);
  const htmlBody = buildInspectionReportHtml(params.row, params.inquiry);
  const pdfLinkBlock = params.pdfUrl
    ? `<p style="margin-top:16px;"><a href="${params.pdfUrl}">완료본 PDF 다운로드</a></p>`
    : '';
  const viewLinkBlock = params.customerViewUrl
    ? `<p style="margin-top:12px;"><a href="${params.customerViewUrl}">웹에서 검수본 보기</a></p>`
    : '';

  const html = `${htmlBody.replace('</body>', `${pdfLinkBlock}${viewLinkBlock}</body>`)}`;

  const text =
    plain +
    (params.pdfUrl ? `\n\nPDF: ${params.pdfUrl}` : '') +
    (params.customerViewUrl ? `\n\n웹 열람: ${params.customerViewUrl}` : '');

  const attachment =
    params.pdfBuffer && params.pdfBuffer.length > 0 && params.pdfBuffer.length <= GMAIL_SAFE_ATTACHMENT_BYTES
      ? {
          filename: `현장검수_${params.inquiry.customerName.slice(0, 20)}.pdf`,
          content: params.pdfBuffer,
          contentType: 'application/pdf' as const,
        }
      : undefined;

  const mailInput = {
    to: email,
    subject,
    html,
    text,
  };

  if (attachment) {
    try {
      await sendMailForTenant(params.tenantId, { ...mailInput, attachments: [attachment] });
      return true;
    } catch (e) {
      console.warn(
        '[inspection-email] PDF 첨부 발송 실패 — 링크만 포함해 재시도',
        formatSmtpSendError(e),
      );
    }
  } else if (params.pdfBuffer && params.pdfBuffer.length > GMAIL_SAFE_ATTACHMENT_BYTES) {
    console.warn(
      '[inspection-email] PDF가 커서 첨부 생략',
      params.pdfBuffer.length,
      'bytes — 다운로드 링크만 발송',
    );
  }

  await sendMailForTenant(params.tenantId, mailInput);
  return true;
}
