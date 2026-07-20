import { formatSmtpSendError, sendMailForTenant } from '../../lib/tenantSmtp.service.js';
import { QUOTATION_DOCUMENT_TYPE_LABELS, type QuotationDocumentType } from './quotationDocument.js';
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
  const documentType = (quotation.documentType ?? 'QUOTATION') as QuotationDocumentType;
  const documentLabel = QUOTATION_DOCUMENT_TYPE_LABELS[documentType];

  try {
    return await sendMailForTenant(
      tenantId,
      {
        to,
        subject,
        text,
        html: text.replace(/\n/g, '<br>'),
        attachments: [
          {
            filename: `${documentLabel}_${quotation.quoteNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      },
      quotation.operatingCompanyId,
    );
  } catch (e) {
    console.error('[quotation-email] send failed', formatSmtpSendError(e), e);
    throw e;
  }
}
