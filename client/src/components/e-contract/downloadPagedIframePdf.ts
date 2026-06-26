import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { settleIframeForRasterCapture, waitUntilPagedDomPainted } from './eContractPagedCaptureWait';
import { inlineExternalImages, waitForImagesIn } from './eContractPdfImageInline';
import { readAppendixSourceHtml } from './eContractPagedHtml';

export function sanitizeEContractPdfFilenameBase(raw: string): string {
  const t = (raw ?? '').trim().replace(/[/\\?%*:|"<>]/g, '_');
  return t.slice(0, 180) || '계약서';
}

function pageContentWidth(doc: Document): number {
  const content = doc.querySelector('.pagedjs_page_content') as HTMLElement | null;
  const page = doc.querySelector('.pagedjs_pages .pagedjs_page') as HTMLElement | null;
  return Math.max(
    320,
    Math.round(content?.getBoundingClientRect().width || page?.getBoundingClientRect().width || doc.body.clientWidth || 794),
  );
}

/** 본문 페이지만 — 부록은 PDF에서 별도 페이지로 항상 캡처 */
function collectMainContractPages(doc: Document): HTMLElement[] {
  let pages = Array.from(doc.querySelectorAll('.pagedjs_pages .pagedjs_page')) as HTMLElement[];
  if (pages.length === 0) {
    pages = Array.from(doc.querySelectorAll('.pagedjs_page')) as HTMLElement[];
  }

  const filtered = pages.filter((page) => {
    if (page.getAttribute('data-ec-appendix-injected') === '1') return false;
    if (page.querySelector('.ec-party-appendix')) return false;
    return true;
  });

  if (filtered.length > 0) return filtered;

  const article = doc.querySelector('article.e-contract-body-html');
  if (article) return [article as HTMLElement];
  return [doc.body];
}

async function buildDedicatedAppendixCapture(doc: Document, win: Window): Promise<HTMLElement | null> {
  const appendixHtml = readAppendixSourceHtml(doc);
  if (!appendixHtml) return null;

  const width = pageContentWidth(doc);
  const wrap = doc.createElement('div');
  wrap.className = 'ec-pdf-appendix-capture-root';
  wrap.setAttribute('data-ec-pdf-appendix-fallback', '1');
  wrap.style.boxSizing = 'border-box';
  wrap.style.width = `${width}px`;
  wrap.style.background = '#ffffff';
  wrap.style.padding = '0';
  wrap.style.margin = '0';
  wrap.style.position = 'absolute';
  wrap.style.left = '-99999px';
  wrap.style.top = '0';
  wrap.innerHTML = appendixHtml;
  doc.body.appendChild(wrap);

  await inlineExternalImages(wrap, win);
  await waitForImagesIn(wrap);

  return wrap;
}

async function rasterizeElement(el: HTMLElement, win: Window): Promise<HTMLCanvasElement> {
  await inlineExternalImages(el, win);
  await waitForImagesIn(el);

  const w = Math.max(1, Math.ceil(el.scrollWidth || el.getBoundingClientRect().width));
  const h = Math.max(1, Math.ceil(el.scrollHeight || el.getBoundingClientRect().height));

  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: w,
    height: h,
    windowWidth: w,
    windowHeight: h,
  });
}

/**
 * Paged.js 미리보기 iframe을 캡처해 PDF로 저장합니다.
 * 갑·을 부록(직인·서명)은 Paged.js 배치와 무관하게 template 원본으로 마지막 페이지를 항상 추가합니다.
 */
export async function downloadPagedIframeAsPdf(
  iframe: HTMLIFrameElement | null | undefined,
  filenameBase: string,
): Promise<void> {
  if (!iframe?.contentDocument?.body || !iframe.contentWindow) {
    throw new Error('미리보기 문서를 찾지 못했습니다.');
  }
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;

  await waitUntilPagedDomPainted(doc);
  await settleIframeForRasterCapture(iframe);

  const mainPages = collectMainContractPages(doc);
  const appendixCapture = await buildDedicatedAppendixCapture(doc, win);
  const targets = appendixCapture ? [...mainPages, appendixCapture] : mainPages;

  if (targets.length === 0) {
    throw new Error('PDF로 저장할 페이지를 찾지 못했습니다.');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < targets.length; i++) {
    const el = targets[i];
    const canvas = await rasterizeElement(el, win);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const cw = canvas.width;
    const ch = canvas.height;
    if (!cw || !ch) continue;

    let imgW = pageW;
    let imgH = (ch / cw) * imgW;
    if (imgH > pageH) {
      imgH = pageH;
      imgW = (cw / ch) * imgH;
    }
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
  }

  for (const el of doc.querySelectorAll('[data-ec-pdf-appendix-fallback="1"]')) {
    el.remove();
  }

  const safe = sanitizeEContractPdfFilenameBase(filenameBase);
  pdf.save(`${safe}.pdf`);
}
