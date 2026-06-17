import PDFDocument from 'pdfkit';
import { resolvePdfKoreanFontPath } from '../inquiry-inspection/inquiryInspection.report.js';
import type { TenantCompanyRegistrationConfig } from '../tenants/tenantConfig.schema.js';
import type { QuotationRow } from './quotations.service.js';

function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatDateKst(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export async function buildQuotationPdfBuffer(
  quotation: QuotationRow,
  company: TenantCompanyRegistrationConfig | undefined,
): Promise<Buffer> {
  const fontPath = resolvePdfKoreanFontPath();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    if (fontPath) {
      doc.font(fontPath);
    } else {
      console.warn('[quotation-pdf] Korean font not found — set INSPECTION_PDF_FONT_PATH');
    }

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const companyName = company?.companyName?.trim() || '견적서';
    const rightX = doc.page.margins.left + pageWidth * 0.55;

    doc.fontSize(18).text('견 적 서', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#444').text(`견적번호: ${quotation.quoteNumber}`, { align: 'center' });
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor('#111');
    doc.text(companyName, doc.page.margins.left, doc.y, { width: pageWidth * 0.5 });
    const headerTop = doc.y - doc.currentLineHeight();
    doc.fontSize(9).fillColor('#333');
    let rightY = headerTop;
    const rightLines: string[] = [];
    if (company?.representativeName?.trim()) {
      rightLines.push(`대표: ${company.representativeName.trim()}`);
    }
    if (company?.businessRegistrationNo?.trim()) {
      rightLines.push(`사업자등록번호: ${company.businessRegistrationNo.trim()}`);
    }
    if (company?.addressLine?.trim()) {
      rightLines.push(`주소: ${company.addressLine.trim()}`);
    }
    if (company?.phone?.trim()) {
      rightLines.push(`전화: ${company.phone.trim()}`);
    }
    if (company?.fax?.trim()) {
      rightLines.push(`팩스: ${company.fax.trim()}`);
    }
    if (company?.contactEmail?.trim()) {
      rightLines.push(`이메일: ${company.contactEmail.trim()}`);
    }
    for (const line of rightLines) {
      doc.text(line, rightX, rightY, { width: pageWidth * 0.45, align: 'right' });
      rightY += doc.currentLineHeight() + 2;
    }
    doc.y = Math.max(doc.y, rightY);
    doc.moveDown(1);

    doc.fontSize(10).fillColor('#111');
    doc.text(`수신: ${quotation.customerName}`, { underline: false });
    if (quotation.customerPhone?.trim()) doc.text(`연락처: ${quotation.customerPhone.trim()}`);
    if (quotation.customerAddress?.trim()) doc.text(`주소: ${quotation.customerAddress.trim()}`);
    doc.text(`작성일: ${formatDateKst(quotation.createdAt)}`);
    if (quotation.validUntil) {
      doc.text(`유효기간: ${formatDateKst(quotation.validUntil)} 까지`);
    }
    doc.moveDown(0.8);

    const colNo = doc.page.margins.left;
    const colLabel = colNo + 24;
    const colQty = colNo + pageWidth * 0.55;
    const colUnit = colNo + pageWidth * 0.68;
    const colAmt = colNo + pageWidth * 0.82;
    const rowH = 20;

    doc.rect(colNo, doc.y, pageWidth, rowH).fill('#e5e7eb');
    doc.fillColor('#111').fontSize(9);
    const tableTop = doc.y + 5;
    doc.text('No', colNo + 4, tableTop, { width: 20 });
    doc.text('항목', colLabel, tableTop, { width: pageWidth * 0.48 });
    doc.text('수량', colQty, tableTop, { width: 40, align: 'right' });
    doc.text('단가', colUnit, tableTop, { width: 60, align: 'right' });
    doc.text('금액', colAmt, tableTop, { width: 70, align: 'right' });
    doc.y = tableTop + rowH;

    quotation.lineItems.forEach((li, idx) => {
      if (doc.y > doc.page.height - 120) doc.addPage();
      const y = doc.y;
      doc.fillColor('#333').fontSize(9);
      doc.text(String(idx + 1), colNo + 4, y, { width: 20 });
      doc.text(li.label, colLabel, y, { width: pageWidth * 0.48 });
      doc.text(String(li.quantity), colQty, y, { width: 40, align: 'right' });
      doc.text(formatWon(li.unitPrice), colUnit, y, { width: 60, align: 'right' });
      doc.text(formatWon(li.lineAmount), colAmt, y, { width: 70, align: 'right' });
      doc.y = y + rowH;
    });

    doc.moveDown(0.5);
    const summaryX = colNo + pageWidth * 0.55;
    doc.fontSize(9).fillColor('#111');
    doc.text(`소계: ${formatWon(quotation.subtotal)}`, summaryX, doc.y, {
      width: pageWidth * 0.45,
      align: 'right',
    });
    if (quotation.discountAmount > 0) {
      doc.text(`할인: -${formatWon(quotation.discountAmount)}`, summaryX, doc.y, {
        width: pageWidth * 0.45,
        align: 'right',
      });
    }
    doc.fontSize(11);
    doc.text(`합계: ${formatWon(quotation.total)}`, summaryX, doc.y, {
      width: pageWidth * 0.45,
      align: 'right',
    });
    doc.fontSize(8).fillColor('#666');
    doc.text('(부가세 별도)', summaryX, doc.y, { width: pageWidth * 0.45, align: 'right' });

    if (quotation.memo?.trim()) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#333').text('비고', { underline: true });
      doc.moveDown(0.2);
      doc.text(quotation.memo.trim(), { lineGap: 2 });
    }

    doc.end();
  });
}
