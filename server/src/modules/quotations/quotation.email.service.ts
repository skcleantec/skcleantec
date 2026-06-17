import { formatSmtpSendError, sendMailForTenant } from '../../lib/tenantSmtp.service.js';
import type { QuotationRow } from './quotations.service.js';

export async function sendQuotationEmail(params: {
  tenantId: string;
  quotation: QuotationRow;
  to: string;
  pdfBuffer: Buffer;
  companyName: string;
}): Promise<boolean> {
  const { tenantId, quotation, to, pdfBuffer, companyName } = params;
  const subject = `[${companyName}] 견적서 ${quotation.quoteNumber} — ${quotation.customerName}`;
  const text =
    `${quotation.customerName} 고객님, 안녕하세요.\n\n` +
    `요청하신 견적서(${quotation.quoteNumber})를 첨부드립니다.\n` +
    `합계: ${quotation.total.toLocaleString('ko-KR')}원 (부가세 별도)\n\n` +
    `문의 사항이 있으시면 연락 주시기 바랍니다.\n\n` +
    `${companyName}`;

  try {
    return await sendMailForTenant(tenantId, {
      to,
      subject,
      text,
      html: text.replace(/\n/g, '<br>'),
      attachments: [
        {
          filename: `견적서_${quotation.quoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (e) {
    console.error('[quotation-email] send failed', formatSmtpSendError(e), e);
    throw e;
  }
}
