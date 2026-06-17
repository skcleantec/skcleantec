import { formatSmtpSendError, sendMailForTenant } from '../../lib/tenantSmtp.service.js';
import type { QuotationRow } from './quotations.service.js';

export async function sendQuotationEmail(params: {
  tenantId: string;
  quotation: QuotationRow;
  to: string;
  subject: string;
  body: string;
  pdfBuffer: Buffer;
}): Promise<boolean> {
  const { tenantId, quotation, to, subject, body, pdfBuffer } = params;
  const text = body;

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
