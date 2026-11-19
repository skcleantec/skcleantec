/** 견적 미리보기 — 금액(원) 구간만 강조할 수 있게 나눈다. */

export type QuotePreviewSegment = { text: string; emphasis: boolean };

const WON_RE = /\d{1,3}(?:,\d{3})+원/g;

export function quotePreviewSegments(text: string): QuotePreviewSegment[] {
  const segments: QuotePreviewSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(WON_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: text.slice(last, index), emphasis: false });
    segments.push({ text: match[0], emphasis: true });
    last = index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), emphasis: false });
  if (segments.length === 0) segments.push({ text, emphasis: false });
  return segments;
}
