import { eContractBodyLooksLikeHtml } from './sanitizeEContractHtml';

const READING_BASE_PX = 15;
/** 이 크기 이하로 지정된 글자는 그대로 둔다 */
const KEEP_AS_IS_MAX_PX = 16;

function inlineFontPx(raw: string): number | null {
  const m = /^\s*([\d.]+)\s*(px|pt)\s*$/i.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2].toLowerCase() === 'pt' ? n * (4 / 3) : n;
}

/**
 * 체결 화면 「계약서 읽기」용 본문.
 * 종이(A4)에 맞춰 크게 지정한 글자 크기를 휴대폰에서 읽기 좋은 크기로 줄인다(큰 제목과의 비율은 유지).
 * 화면 표시만 바꾸며, 저장되는 계약문·PDF 는 건드리지 않는다.
 */
export function eContractBodyForReading(body: string): string {
  if (!body || !eContractBodyLooksLikeHtml(body) || typeof DOMParser === 'undefined') return body;
  try {
    const doc = new DOMParser().parseFromString(`<div id="ec-reading-root">${body}</div>`, 'text/html');
    const root = doc.getElementById('ec-reading-root');
    if (!root) return body;

    // 체결 전에는 채워지지 않는 자리 표시는 읽는 화면에서 숨긴다
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    for (const t of textNodes) {
      if (t.data.includes('[[EC_')) t.data = t.data.replace(/\[\[EC_[A-Z0-9_]+\]\]/g, '');
    }

    const sized: { el: HTMLElement; px: number }[] = [];
    const weight = new Map<number, number>();
    root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
      const px = inlineFontPx(el.style.fontSize);
      if (px == null) return;
      sized.push({ el, px });
      const key = Math.round(px);
      weight.set(key, (weight.get(key) ?? 0) + (el.textContent ?? '').trim().length);
    });

    let dominant = 0;
    let best = 0;
    for (const [px, w] of weight) {
      if (w > best) {
        best = w;
        dominant = px;
      }
    }
    if (dominant > KEEP_AS_IS_MAX_PX) {
      const ratio = READING_BASE_PX / dominant;
      for (const { el, px } of sized) {
        if (px <= KEEP_AS_IS_MAX_PX) continue;
        const next = Math.max(READING_BASE_PX, Math.min(22, Math.round(px * ratio)));
        el.style.fontSize = `${next}px`;
        el.style.lineHeight = '';
      }
    }
    return root.innerHTML;
  } catch {
    return body;
  }
}
