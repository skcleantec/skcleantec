import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { settleIframeForRasterCapture, waitUntilPagedDomPainted } from './eContractPagedCaptureWait';

export function sanitizeEContractPdfFilenameBase(raw: string): string {
  const t = (raw ?? '').trim().replace(/[/\\?%*:|"<>]/g, '_');
  return t.slice(0, 180) || '계약서';
}

/**
 * Paged.js 미리보기 iframe(.pagedjs_page)을 순서대로 캡처해 단일 PDF로 저장합니다.
 * 화면 미리보기와 동일한 `.pagedjs_page` 단위로 캡처합니다.
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

  let pages = Array.from(doc.querySelectorAll('.pagedjs_pages .pagedjs_page')) as HTMLElement[];
  if (pages.length === 0) {
    pages = Array.from(doc.querySelectorAll('.pagedjs_page')) as HTMLElement[];
  }

  if (pages.length === 0) {
    const article = doc.querySelector('article.e-contract-body-html');
    if (article) {
      pages = [article as HTMLElement];
    } else {
      pages = [doc.body];
    }
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const el = pages[i];
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

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

  const safe = sanitizeEContractPdfFilenameBase(filenameBase);
  pdf.save(`${safe}.pdf`);
}
