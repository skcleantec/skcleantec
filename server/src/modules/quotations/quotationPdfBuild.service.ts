import type { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getTenantCompanyProfile } from '../tenants/tenantCompanyProfile.service.js';
import { buildQuotationPdfBuffer } from './quotation.pdf.service.js';
import { uploadQuotationPdfBuffer } from './quotation.pdfUpload.service.js';
import { getOrCreateQuotationConfig } from './quotationConfig.service.js';
import { quotationInclude, type QuotationRow } from './quotations.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type QuotationPdfBuildOptions = {
  documentTitle?: string | null;
  footerNotice?: string | null;
};

export async function loadQuotationPdfOptions(
  db: Db,
  tenantId: string,
): Promise<QuotationPdfBuildOptions> {
  const config = await getOrCreateQuotationConfig(db, tenantId);
  return {
    documentTitle: config.documentTitle?.trim() || '견적서',
    footerNotice: config.footerNotice,
  };
}

export async function buildQuotationPdfForRow(
  row: QuotationRow,
  tenantId: string,
  pdfOptions?: QuotationPdfBuildOptions,
): Promise<Buffer> {
  const opts = pdfOptions ?? (await loadQuotationPdfOptions(prisma, tenantId));
  const profile = await getTenantCompanyProfile(tenantId);
  return buildQuotationPdfBuffer(row, profile.companyRegistration, {
    documentTitle: opts.documentTitle,
    footerNotice: opts.footerNotice,
  });
}

export async function generateAndStoreQuotationPdf(
  db: Db,
  quotationId: string,
  tenantId: string,
): Promise<{ buffer: Buffer; publicId: string | null; secureUrl: string | null }> {
  const row = await db.quotation.findFirst({
    where: { id: quotationId, tenantId },
    include: quotationInclude,
  });
  if (!row) throw new Error('견적서를 찾을 수 없습니다.');

  const pdfOptions = await loadQuotationPdfOptions(db, tenantId);
  const profile = await getTenantCompanyProfile(tenantId);
  const buffer = await buildQuotationPdfBuffer(row, profile.companyRegistration, {
    documentTitle: pdfOptions.documentTitle,
    footerNotice: pdfOptions.footerNotice,
  });

  let publicId: string | null = null;
  let secureUrl: string | null = null;
  try {
    const up = await uploadQuotationPdfBuffer({
      tenantId,
      quotationId: row.id,
      quoteNumber: row.quoteNumber,
      buffer,
    });
    if (up) {
      publicId = up.publicId;
      secureUrl = up.secureUrl;
      await db.quotation.update({
        where: { id: row.id },
        data: { pdfPublicId: publicId, pdfSecureUrl: secureUrl },
      });
    }
  } catch (e) {
    console.error('[quotation-pdf] cloudinary upload failed', e);
  }

  return { buffer, publicId, secureUrl };
}
