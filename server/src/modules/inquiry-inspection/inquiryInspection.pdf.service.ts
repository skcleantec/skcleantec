import PDFDocument from 'pdfkit';
import {
  buildInspectionReportPlainText,
  resolvePdfKoreanFontPath,
} from './inquiryInspection.report.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

export async function buildInspectionPdfBuffer(
  row: ChecklistRow,
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  },
): Promise<Buffer> {
  const text = buildInspectionReportPlainText(row, inquiry);
  const fontPath = resolvePdfKoreanFontPath();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (fontPath) {
      doc.font(fontPath);
    } else {
      console.warn('[inspection-pdf] Korean font not found — set INSPECTION_PDF_FONT_PATH or install fonts-nanum');
    }

    doc.fontSize(16).text('청소 서비스 현장 검수 체크리스트', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const line of text.split('\n')) {
      doc.text(line, { lineGap: 2 });
    }
    doc.end();
  });
}
