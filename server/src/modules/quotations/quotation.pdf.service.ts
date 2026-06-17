import PDFDocument from 'pdfkit';
import { resolvePdfKoreanFontPath } from '../inquiry-inspection/inquiryInspection.report.js';
import type { TenantCompanyRegistrationConfig } from '../tenants/tenantConfig.schema.js';
import type { QuotationRow } from './quotations.service.js';
import {
  computeQuotationVatAmounts,
  vatModeLabel,
  type QuotationVatMode,
} from './quotationVat.js';

type PdfDoc = InstanceType<typeof PDFDocument>;

const ROW_H = 18;
/** 하단 합계·마무리 문구·푸터 예약 높이 */
const BOTTOM_RESERVE = 168;

function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatDateKst(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function drawBox(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: string,
) {
  if (fill) {
    doc.save().rect(x, y, w, h).fill(fill).restore();
  }
  doc.rect(x, y, w, h).stroke('#cccccc');
}

function contentMaxY(doc: PdfDoc): number {
  return doc.page.height - doc.page.margins.bottom - BOTTOM_RESERVE;
}

function ensureRowSpace(doc: PdfDoc, rowY: number): number {
  if (rowY + ROW_H <= contentMaxY(doc)) return rowY;
  doc.addPage();
  return doc.page.margins.top;
}

function drawAmountSummary(
  doc: PdfDoc,
  ml: number,
  pageWidth: number,
  anchorBottomY: number,
  quotation: QuotationRow,
  vatMode: QuotationVatMode,
) {
  const { vatAmount, grandTotal } = computeQuotationVatAmounts(quotation.total, vatMode);
  const hasDiscount = quotation.discountAmount > 0;
  const detailH = hasDiscount ? 14 : 0;
  const mainH = 36;
  const boxH = detailH + mainH;
  const boxY = anchorBottomY - boxH;

  if (hasDiscount) {
    doc.fontSize(8).fillColor('#555');
    doc.text(`소계  ${formatWon(quotation.subtotal)}`, ml, boxY, {
      width: pageWidth,
      align: 'right',
    });
    doc.text(`할인  -${formatWon(quotation.discountAmount)}`, ml, doc.y, {
      width: pageWidth,
      align: 'right',
    });
  }

  const mainY = hasDiscount ? boxY + detailH : boxY;
  const colW = pageWidth / 3;

  drawBox(doc, ml, mainY, colW, mainH, '#f3f4f6');
  drawBox(doc, ml + colW, mainY, colW, mainH, '#f3f4f6');
  drawBox(doc, ml + colW * 2, mainY, colW, mainH, '#e5e7eb');

  doc.fontSize(8).fillColor('#666');
  const labelY = mainY + 6;
  doc.text('공급가액', ml, labelY, { width: colW, align: 'center' });
  doc.text('부가세', ml + colW, labelY, { width: colW, align: 'center' });
  doc.text('합계금액', ml + colW * 2, labelY, { width: colW, align: 'center' });

  doc.fontSize(10).fillColor('#111');
  const valY = mainY + 18;
  doc.text(formatWon(quotation.total), ml, valY, { width: colW, align: 'center' });
  doc.text(formatWon(vatAmount), ml + colW, valY, { width: colW, align: 'center' });
  doc.fontSize(11).fillColor('#000');
  doc.text(formatWon(grandTotal), ml + colW * 2, valY, { width: colW, align: 'center' });

  doc.fontSize(7.5).fillColor('#888');
  doc.text(`(${vatModeLabel(vatMode)})`, ml, mainY + mainH + 2, {
    width: pageWidth,
    align: 'right',
  });
}

function drawClosingBlock(
  doc: PdfDoc,
  ml: number,
  pageWidth: number,
  startY: number,
  footerNotice: string | null | undefined,
) {
  let y = startY;
  doc.fontSize(9).fillColor('#111').text('위와 같이 견적합니다.', ml, y, {
    width: pageWidth,
    align: 'center',
  });
  y = doc.y + 8;
  const footer = footerNotice?.trim();
  if (footer) {
    doc.fontSize(8).fillColor('#555').text(footer, ml, y, { width: pageWidth, lineGap: 2 });
  }
}

export async function buildQuotationPdfBuffer(
  quotation: QuotationRow,
  company: TenantCompanyRegistrationConfig | undefined,
  options?: { footerNotice?: string | null; documentTitle?: string | null },
): Promise<Buffer> {
  const fontPath = resolvePdfKoreanFontPath();
  const title = options?.documentTitle?.trim() || '견적서';
  const companyName = company?.companyName?.trim() || '—';
  const vatMode = (quotation.vatMode ?? 'VAT_SEPARATE') as QuotationVatMode;

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

    const ml = doc.page.margins.left;
    const pageWidth = doc.page.width - ml - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    // ── 머리말 ──
    doc.fontSize(20).fillColor('#111').text(title, { align: 'center' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#555').text(`No. ${quotation.quoteNumber}`, { align: 'center' });
    doc.moveDown(0.9);

    const boxH = 88;
    const boxW = (pageWidth - 12) / 2;
    const boxY = doc.y;

    drawBox(doc, ml, boxY, boxW, boxH, '#f9fafb');
    drawBox(doc, ml + boxW + 12, boxY, boxW, boxH, '#f9fafb');

    doc.fontSize(8).fillColor('#666');
    doc.text('공급자', ml + 8, boxY + 6);
    doc.text('공급받는자', ml + boxW + 20, boxY + 6);

    doc.fontSize(9).fillColor('#111');
    let leftY = boxY + 18;
    const leftLines = [
      companyName,
      company?.representativeName?.trim() ? `대표 ${company.representativeName.trim()}` : null,
      company?.businessRegistrationNo?.trim()
        ? `사업자 ${company.businessRegistrationNo.trim()}`
        : null,
      company?.addressLine?.trim() ?? null,
      company?.phone?.trim() ? `Tel ${company.phone.trim()}` : null,
      company?.contactEmail?.trim() ?? null,
    ].filter(Boolean) as string[];
    for (const line of leftLines) {
      doc.text(line, ml + 8, leftY, { width: boxW - 16, lineGap: 1 });
      leftY += doc.currentLineHeight() + 1;
    }

    let rightY = boxY + 18;
    const rightLines = [
      quotation.customerName,
      quotation.customerPhone?.trim() ? `Tel ${quotation.customerPhone.trim()}` : null,
      quotation.customerEmail?.trim() ?? null,
      quotation.customerAddress?.trim() ?? null,
    ].filter(Boolean) as string[];
    for (const line of rightLines) {
      doc.text(line, ml + boxW + 20, rightY, { width: boxW - 16, lineGap: 1 });
      rightY += doc.currentLineHeight() + 1;
    }

    doc.y = boxY + boxH + 14;
    doc.fontSize(9).fillColor('#333');
    doc.text(`작성일: ${formatDateKst(quotation.createdAt)}`, ml);
    if (quotation.validUntil) {
      doc.text(`유효기간: ${formatDateKst(quotation.validUntil)} 까지`, ml);
    }
    doc.text(`과세: ${vatModeLabel(vatMode)}`, ml);
    doc.moveDown(0.6);

    const colNo = ml;
    const colLabel = ml + 22;
    const colQty = ml + pageWidth * 0.58;
    const colUnit = ml + pageWidth * 0.72;
    const colAmt = ml + pageWidth * 0.86;

    const tableTop = doc.y;
    drawBox(doc, colNo, tableTop, pageWidth, ROW_H, '#e5e7eb');
    doc.fillColor('#111').fontSize(8.5);
    const hdrY = tableTop + 5;
    doc.text('No', colNo + 4, hdrY, { width: 16 });
    doc.text('품목', colLabel, hdrY, { width: pageWidth * 0.5 });
    doc.text('수량', colQty, hdrY, { width: 36, align: 'right' });
    doc.text('단가', colUnit, hdrY, { width: 56, align: 'right' });
    doc.text('금액', colAmt, hdrY, { width: 64, align: 'right' });

    let rowY = tableTop + ROW_H;
    quotation.lineItems.forEach((li, idx) => {
      rowY = ensureRowSpace(doc, rowY);
      drawBox(doc, colNo, rowY, pageWidth, ROW_H);
      doc.fillColor('#333').fontSize(8.5);
      const ty = rowY + 5;
      doc.text(String(idx + 1), colNo + 4, ty, { width: 16 });
      doc.text(li.label, colLabel, ty, { width: pageWidth * 0.5 });
      doc.text(String(li.quantity), colQty, ty, { width: 36, align: 'right' });
      doc.text(formatWon(li.unitPrice), colUnit, ty, { width: 56, align: 'right' });
      doc.text(formatWon(li.lineAmount), colAmt, ty, { width: 64, align: 'right' });
      rowY += ROW_H;
    });

    // 비고 — 합계 블록 위 공간에 표시
    if (quotation.memo?.trim()) {
      const memoTop = rowY + 10;
      if (memoTop + 40 > contentMaxY(doc)) {
        doc.addPage();
        rowY = doc.page.margins.top;
      } else {
        rowY = memoTop;
      }
      doc.fontSize(9).fillColor('#333').text('비고', ml, rowY, { underline: true });
      doc.moveDown(0.15);
      doc.fontSize(8.5).text(quotation.memo.trim(), ml, doc.y, { width: pageWidth, lineGap: 2 });
    }

    // ── 하단 고정: 합계(공급가액·부가세·합계금액) + 마무리 ──
    const summaryBottomY = pageBottom - 52;
    if (doc.y + 20 > summaryBottomY - 80) {
      doc.addPage();
    }
    drawAmountSummary(doc, ml, pageWidth, summaryBottomY, quotation, vatMode);
    drawClosingBlock(doc, ml, pageWidth, summaryBottomY + 8, options?.footerNotice);

    doc.end();
  });
}
