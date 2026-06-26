import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  contractHtmlExpectsPartyAppendix,
  settleIframeForRasterCapture,
  waitUntilPagedDomPainted,
} from './eContractPagedCaptureWait';
import { splitContractMainAndPartyAppendix } from './eContractPagedHtml';

export function sanitizeEContractPdfFilenameBase(raw: string): string {
  const t = (raw ?? '').trim().replace(/[/\\?%*:|"<>]/g, '_');
  return t.slice(0, 180) || '계약서';
}

/** Paged.js가 만든 페이지에서 실제 본문 영역만 캡처 대상으로 선택 */
function collectPagedCaptureTargets(doc: Document): HTMLElement[] {
  const pageEls = Array.from(doc.querySelectorAll('.pagedjs_pages .pagedjs_page')) as HTMLElement[];
  const targets: HTMLElement[] = [];

  for (const page of pageEls) {
    if (page.classList.contains('ec-appendix-dedicated-page')) continue;
    const content = page.querySelector('.pagedjs_page_content') as HTMLElement | null;
    const box = page.querySelector('.pagedjs_pagebox') as HTMLElement | null;
    targets.push(content ?? box ?? page);
  }

  if (targets.length === 0) {
    const pages = Array.from(doc.querySelectorAll('.pagedjs_page')) as HTMLElement[];
    for (const page of pages) {
      if (page.classList.contains('ec-appendix-dedicated-page')) continue;
      const content = page.querySelector('.pagedjs_page_content') as HTMLElement | null;
      targets.push(content ?? page);
    }
  }

  if (targets.length === 0) {
    const article = doc.querySelector('article.e-contract-body-html');
    if (article) targets.push(article as HTMLElement);
    else targets.push(doc.body);
  }

  const appendixPresent = targets.some((t) => t.querySelector('.ec-party-appendix'));
  if (!appendixPresent && contractHtmlExpectsPartyAppendix(doc)) {
    const sourceHtml =
      (doc.querySelector('article.e-contract-body-html') as HTMLElement | null)?.innerHTML ??
      doc.body.innerHTML;
    const { appendix } = splitContractMainAndPartyAppendix(sourceHtml);
    if (appendix) {
      const refWidth =
        targets[0]?.getBoundingClientRect().width ||
        pageEls[0]?.getBoundingClientRect().width ||
        doc.body.clientWidth ||
        794;
      const wrap = doc.createElement('div');
      wrap.className = 'ec-pdf-appendix-capture-root';
      wrap.setAttribute('data-ec-pdf-appendix-fallback', '1');
      wrap.style.boxSizing = 'border-box';
      wrap.style.width = `${Math.max(320, Math.round(refWidth))}px`;
      wrap.style.background = '#ffffff';
      wrap.style.padding = '0';
      wrap.innerHTML = appendix;
      wrap.style.position = 'absolute';
      wrap.style.left = '-100000px';
      wrap.style.top = '0';
      doc.body.appendChild(wrap);
      targets.push(wrap);
    }
  }

  return targets;
}

async function rasterizeElement(el: HTMLElement): Promise<HTMLCanvasElement> {
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
 * Paged.js 미리보기 iframe(.pagedjs_page)을 순서대로 캡처해 단일 PDF로 저장합니다.
 * 브라우저 인쇄 대화상자 없이 직접 다운로드합니다.
 */
export async function downloadPagedIframeAsPdf(
  iframe: HTMLIFrameElement | null | undefined,
  filenameBase: string,
): Promise<void> {
  if (!iframe?.contentDocument?.body) {
    throw new Error('미리보기 문서를 찾지 못했습니다.');
  }
  const doc = iframe.contentDocument;

  await waitUntilPagedDomPainted(doc);
  await settleIframeForRasterCapture(iframe);

  const targets = collectPagedCaptureTargets(doc);
  if (targets.length === 0) {
    throw new Error('PDF로 저장할 페이지를 찾지 못했습니다.');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < targets.length; i++) {
    const el = targets[i];
    const canvas = await rasterizeElement(el);

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
    const y = 0;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', x, y, imgW, imgH);
  }

  for (const el of doc.querySelectorAll('[data-ec-pdf-appendix-fallback="1"]')) {
    el.remove();
  }

  const safe = sanitizeEContractPdfFilenameBase(filenameBase);
  pdf.save(`${safe}.pdf`);
}
