import PDFDocument from 'pdfkit';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { resolvePdfKoreanFontPath } from '../inquiry-inspection/inquiryInspection.report.js';
import { RECEIPT_COPY_FOOTER } from './receiptCopy.mask.js';

export type ReceiptCopyLine = { label: string; value: string };

export type ReceiptCopyView = {
  title: string;
  badge: string | null;
  rows: ReceiptCopyLine[];
  items: { name: string; supply: string; tax: string; total: string }[];
  totals: ReceiptCopyLine[];
  approval: string;
  logo: Buffer | null;
};

const PAGE_W = 420;
const MARGIN = 28;
const FOOTER = RECEIPT_COPY_FOOTER;

let fontReady = false;
function ensureFont(): string | null {
  const path = resolvePdfKoreanFontPath();
  if (!path) return null;
  if (!fontReady) {
    GlobalFonts.registerFromPath(path, 'ReceiptKR');
    fontReady = true;
  }
  return path;
}

function badgeColor(badge: string | null): string {
  if (badge === '취소') return '#b91c1c';
  if (badge === '국세청 전송 중') return '#b45309';
  return '#0f172a';
}

export function renderReceiptPdf(view: ReceiptCopyView): Promise<Buffer> {
  const font = ensureFont();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE_W, 760], margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const draw = (text: string, size: number, color = '#0f172a') => {
      if (font) doc.font(font);
      doc.fillColor(color).fontSize(size).text(text, MARGIN, doc.y, { width: PAGE_W - MARGIN * 2 });
    };
    draw(view.title, 16);
    if (view.badge) draw(view.badge, 12, badgeColor(view.badge));
    if (view.logo) {
      try {
        doc.image(view.logo, MARGIN, doc.y + 4, { fit: [72, 72] });
        doc.y += 80;
      } catch {
        /* 로고를 그리지 못하면 글자만 남긴다 */
      }
    }
    doc.moveDown(0.4);
    for (const row of view.rows) draw(`${row.label}  ${row.value}`, 10);
    doc.moveDown(0.3);
    for (const item of view.items) {
      draw(item.name, 10);
      draw(item.tax ? `공급가액 ${item.supply}   세액 ${item.tax}   합계 ${item.total}` : `공급가액 ${item.supply}   합계 ${item.total}`, 9, '#334155');
    }
    doc.moveDown(0.3);
    for (const row of view.totals) draw(`${row.label}  ${row.value}`, 11);
    draw(`국세청 승인번호  ${view.approval}`, 11);
    doc.moveDown(0.6);
    draw(FOOTER, 8, '#64748b');
    doc.end();
  });
}

export async function renderReceiptPng(view: ReceiptCopyView): Promise<Buffer> {
  ensureFont();
  const width = 840;
  const pad = 48;
  const measure = createCanvas(width, 100);
  const mctx = measure.getContext('2d');
  const fontOf = (size: number) => `${size}px ${fontReady ? 'ReceiptKR' : 'sans-serif'}`;
  const wrap = (text: string, size: number, max: number): string[] => {
    mctx.font = fontOf(size);
    const lines: string[] = [];
    let current = '';
    for (const ch of text) {
      const next = current + ch;
      if (mctx.measureText(next).width > max && current) {
        lines.push(current);
        current = ch;
      } else current = next;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const blocks: { text: string; size: number; color: string }[] = [];
  const push = (text: string, size: number, color = '#0f172a') => {
    for (const line of wrap(text, size, width - pad * 2)) blocks.push({ text: line, size, color });
  };
  push(view.title, 32);
  if (view.badge) push(view.badge, 24, badgeColor(view.badge));
  for (const row of view.rows) push(`${row.label}  ${row.value}`, 20);
  for (const item of view.items) {
    push(item.name, 20);
    push(item.tax ? `공급가액 ${item.supply}   세액 ${item.tax}   합계 ${item.total}` : `공급가액 ${item.supply}   합계 ${item.total}`, 18, '#334155');
  }
  for (const row of view.totals) push(`${row.label}  ${row.value}`, 22);
  push(`국세청 승인번호  ${view.approval}`, 22);
  push(FOOTER, 16, '#64748b');
  const logo = view.logo ? await loadImage(view.logo).catch(() => null) : null;
  const logoH = logo ? 120 : 0;
  const textH = blocks.reduce((sum, block) => sum + block.size + 14, 0);
  const height = pad * 2 + logoH + textH + 24;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  let y = pad;
  if (logo) {
    ctx.drawImage(logo, pad, y, 120, 120);
    y += logoH + 12;
  }
  for (const block of blocks) {
    ctx.fillStyle = block.color;
    ctx.font = fontOf(block.size);
    ctx.fillText(block.text, pad, y + block.size);
    y += block.size + 14;
  }
  return canvas.toBuffer('image/png');
}
