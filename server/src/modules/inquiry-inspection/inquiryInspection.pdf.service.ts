import PDFDocument from 'pdfkit';
import {
  INSPECTION_BASIC_QUESTIONS,
  INSPECTION_HEADER_INTRO,
  formatInspectionNaReason,
} from '../../lib/inquiryInspectionTemplate.js';
import {
  INSPECTION_CONTAMINATION_AREA_KEY,
  INSPECTION_CONTAMINATION_ITEM_KEY,
  isContaminationInspectionArea,
} from '../../lib/inquiryInspectionContamination.js';
import { INSPECTION_FINAL_CONFIRM_NOTICE } from '../../lib/inquiryInspectionConsent.js';
import {
  buildInspectionReportPlainText,
  resolvePdfKoreanFontPath,
} from './inquiryInspection.report.js';
import { parseBasicAnswers } from './inquiryInspection.validation.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

const PLACEHOLDER_KEYS = new Set(['_legacy', '_pending_seed']);

type ContaminationPdfEntry = {
  url: string;
  caption: string;
};

function collectContaminationPdfEntries(row: ChecklistRow): ContaminationPdfEntry[] {
  const out: ContaminationPdfEntry[] = [];
  for (const area of row.areas) {
    if (area.notApplicable || isContaminationInspectionArea(area.areaKey)) continue;
    for (const item of area.items) {
      if (PLACEHOLDER_KEYS.has(item.itemKey) || item.notApplicable) continue;
      for (const photo of item.photos) {
        if (photo.phase !== 'BEFORE' || !photo.flagged || !photo.secureUrl) continue;
        out.push({
          url: photo.secureUrl,
          caption: `${area.label} · ${item.label}`,
        });
      }
    }
  }
  const contaminationArea = row.areas.find((a) => a.areaKey === INSPECTION_CONTAMINATION_AREA_KEY);
  if (contaminationArea && !contaminationArea.notApplicable) {
    const item =
      contaminationArea.items.find((i) => i.itemKey === INSPECTION_CONTAMINATION_ITEM_KEY) ??
      contaminationArea.items[0];
    if (item && !item.notApplicable) {
      for (const photo of item.photos) {
        if (photo.phase !== 'BEFORE' || !photo.secureUrl) continue;
        out.push({ url: photo.secureUrl, caption: '추가 오염 촬영' });
      }
    }
  }
  return out;
}

async function renderContaminationPdfSection(
  doc: InstanceType<typeof PDFDocument>,
  row: ChecklistRow,
  pageWidth: number,
): Promise<void> {
  const entries = collectContaminationPdfEntries(row);
  if (entries.length === 0) return;

  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.fontSize(11).fillColor('#111').text('오염사진', { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(8).fillColor('#555').text('청소 전 촬영 중 ★ 표시 및 추가 오염 촬영 사진입니다.');
  doc.moveDown(0.35);

  const cols = 3;
  const gap = 8;
  const cellW = (pageWidth - gap * (cols - 1)) / cols;
  const cellH = 64;
  let col = 0;
  let x0 = doc.page.margins.left;
  let y0 = doc.y;

  for (const entry of entries) {
    if (col === 0 && y0 > doc.page.height - cellH - 36) {
      doc.addPage();
      y0 = doc.page.margins.top;
      col = 0;
    }
    const x = x0 + col * (cellW + gap);
    const buf = await fetchImageBuffer(entry.url);
    if (buf) {
      try {
        doc.image(buf, x, y0, { fit: [cellW, cellH], align: 'center', valign: 'center' });
      } catch {
        doc.fontSize(7).fillColor('#999').text('(이미지)', x, y0 + 20, { width: cellW, align: 'center' });
      }
    } else {
      doc.fontSize(7).fillColor('#999').text('(없음)', x, y0 + 20, { width: cellW, align: 'center' });
    }
    doc.fontSize(6.5).fillColor('#444').text(entry.caption, x, y0 + cellH + 2, {
      width: cellW,
      align: 'center',
      lineGap: 0.5,
    });
    col += 1;
    if (col >= cols) {
      col = 0;
      y0 += cellH + 22;
    }
  }
  doc.y = col === 0 ? y0 : y0 + cellH + 22;
  doc.moveDown(0.4);
  doc.fillColor('#333');
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function yn(v: boolean | null): string {
  if (v === true) return '예';
  if (v === false) return '아니오';
  return '—';
}

export async function buildInspectionPdfBuffer(
  row: ChecklistRow,
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  },
): Promise<Buffer> {
  const fontPath = resolvePdfKoreanFontPath();
  const basic = parseBasicAnswers(row.basicAnswersJson);
  const textFallback = buildInspectionReportPlainText(row, inquiry);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('error', reject);

    const done = () => {
      doc.end();
    };

    doc.on('end', () => resolve(Buffer.concat(chunks)));

    if (fontPath) {
      doc.font(fontPath);
    } else {
      console.warn('[inspection-pdf] Korean font not found — set INSPECTION_PDF_FONT_PATH or install fonts-nanum');
    }

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const thumbW = (pageWidth - 12) / 2;
    const thumbH = 72;

    doc.fontSize(15).text('청소 서비스 현장 검수 체크리스트', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#333');
    doc.text(INSPECTION_HEADER_INTRO, { lineGap: 2 });
    doc.moveDown(0.5);
    doc.text(`고객명: ${inquiry.customerName}`);
    if (inquiry.inquiryNumber) doc.text(`접수번호: ${inquiry.inquiryNumber}`);
    doc.text(`서비스일: ${inquiry.preferredDate?.toISOString().slice(0, 10) ?? '—'}`);
    doc.text(`주소: ${inquiry.address}`);
    doc.text(`담당 팀장: ${row.teamLeader.name}`);
    if (row.completedAt) {
      doc.text(
        `완료 일시: ${row.completedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
      );
    }
    doc.moveDown(0.6);

    doc.fontSize(11).fillColor('#111').text('기본사항', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(8.5);
    for (const q of INSPECTION_BASIC_QUESTIONS) {
      const slot = basic[q.id];
      doc.text(`${q.text}`);
      doc.text(`  팀장: ${yn(slot.leader)} / 고객: ${yn(slot.customer)}`, { lineGap: 1 });
    }
    doc.moveDown(0.5);

    doc.fontSize(11).text('구역별 세부 검수 (전·후 사진)', { underline: true });
    doc.moveDown(0.4);

    void (async () => {
      for (const area of row.areas) {
        if (isContaminationInspectionArea(area.areaKey)) continue;
        if (doc.y > doc.page.height - 120) doc.addPage();

        doc.fontSize(10).fillColor('#1e3a8a').text(area.label, { underline: true });
        doc.moveDown(0.25);
        doc.fillColor('#333');

        if (area.notApplicable) {
          doc.fontSize(8.5).text(`구역 전체 해당사항 없음 — ${formatInspectionNaReason(area.naReason)}`);
          doc.moveDown(0.4);
          continue;
        }

        for (const item of area.items) {
          if (PLACEHOLDER_KEYS.has(item.itemKey)) continue;

          if (doc.y > doc.page.height - thumbH - 40) doc.addPage();

          doc.fontSize(9).fillColor('#111').text(`· ${item.label}`);

          if (item.notApplicable) {
            doc.fontSize(8).fillColor('#666').text(`  해당사항 없음 — ${formatInspectionNaReason(item.naReason)}`);
            doc.moveDown(0.25);
            continue;
          }

          const beforePhotos = item.photos.filter((p) => p.phase === 'BEFORE');
          const afterPhotos = item.photos.filter((p) => p.phase === 'AFTER');
          const beforeUrl = beforePhotos[0]?.secureUrl;
          const afterUrl = afterPhotos[0]?.secureUrl;

          const y0 = doc.y + 2;
          let x = doc.page.margins.left;

          doc.fontSize(7.5).fillColor('#555');
          doc.text('청소 전', x, y0, { width: thumbW, align: 'center' });
          doc.text('청소 후', x + thumbW + 12, y0, { width: thumbW, align: 'center' });

          const imgY = y0 + 12;
          if (beforeUrl) {
            const buf = await fetchImageBuffer(beforeUrl);
            if (buf) {
              try {
                doc.image(buf, x, imgY, { fit: [thumbW, thumbH], align: 'center', valign: 'center' });
              } catch {
                doc.fontSize(8).text('(이미지)', x, imgY + 20, { width: thumbW, align: 'center' });
              }
            } else {
              doc.fontSize(8).text('(없음)', x, imgY + 20, { width: thumbW, align: 'center' });
            }
          } else {
            doc.fontSize(8).fillColor('#999').text('(없음)', x, imgY + 20, { width: thumbW, align: 'center' });
          }

          if (afterUrl) {
            const buf = await fetchImageBuffer(afterUrl);
            if (buf) {
              try {
                doc.image(buf, x + thumbW + 12, imgY, {
                  fit: [thumbW, thumbH],
                  align: 'center',
                  valign: 'center',
                });
              } catch {
                doc.fontSize(8).text('(이미지)', x + thumbW + 12, imgY + 20, {
                  width: thumbW,
                  align: 'center',
                });
              }
            } else {
              doc.fontSize(8).text('(없음)', x + thumbW + 12, imgY + 20, {
                width: thumbW,
                align: 'center',
              });
            }
          } else {
            doc.fontSize(8).fillColor('#999').text('(없음)', x + thumbW + 12, imgY + 20, {
              width: thumbW,
              align: 'center',
            });
          }

          const extra =
            beforePhotos.length > 1 || afterPhotos.length > 1
              ? `  (+전 ${Math.max(0, beforePhotos.length - 1)} / +후 ${Math.max(0, afterPhotos.length - 1)})`
              : '';
          doc.y = imgY + thumbH + 4;
          if (extra) {
            doc.fontSize(7).fillColor('#666').text(extra.trim());
          }
          doc.moveDown(0.35);
          doc.fillColor('#333');
        }
        doc.moveDown(0.3);
      }

      await renderContaminationPdfSection(doc, row, pageWidth);

      if (row.leaderNotes?.trim()) {
        if (doc.y > doc.page.height - 80) doc.addPage();
        doc.fontSize(11).fillColor('#111').text('특이사항', { underline: true });
        doc.moveDown(0.25);
        doc.fontSize(8.5).text(row.leaderNotes.trim());
        doc.moveDown(0.4);
      }

      if (row.signatureSecureUrl) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.fontSize(11).text('고객 서명', { underline: true });
        doc.moveDown(0.25);
        const sigBuf = await fetchImageBuffer(row.signatureSecureUrl);
        if (sigBuf) {
          try {
            doc.image(sigBuf, { fit: [180, 70] });
          } catch {
            doc.fontSize(8).text('(서명 이미지)');
          }
        }
        doc.moveDown(0.4);
      }

      if (doc.y > doc.page.height - 60) doc.addPage();
      doc.fontSize(8).fillColor('#334155').text(INSPECTION_FINAL_CONFIRM_NOTICE);
      doc.moveDown(0.5);
      doc.fontSize(7).fillColor('#64748b');
      for (const line of textFallback.split('\n').slice(-8)) {
        if (line.trim()) doc.text(line, { lineGap: 1 });
      }

      done();
    })().catch((e) => {
      reject(e);
    });
  });
}
