/** 고객 발주서 확인·완료 모달 — 관리자 편집용 간단 마크업 */

export const ORDER_FORM_MODAL_TEXT_MARKUP_HELP_LINES = [
  '툴바: 굵게 · 글자크기 · 글자색 · 배경색 · 이모지 · 특수문자',
  'Enter 줄바꿈, 팔레트·직접색(#hex) 모두 저장 후 고객 모달에 반영',
] as const;

const NAMED_COLORS: Record<string, string> = {
  red: '#dc2626',
  amber: '#d97706',
  orange: '#ea580c',
  blue: '#2563eb',
  green: '#16a34a',
  gray: '#4b5563',
  black: '#111827',
};

const NAMED_SIZES: Record<string, string> = {
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveColor(token: string): string | null {
  const key = token.trim().toLowerCase();
  if (NAMED_COLORS[key]) return NAMED_COLORS[key];
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(key)) return key;
  return null;
}

function resolveSize(token: string): string | null {
  const key = token.trim().toLowerCase();
  if (NAMED_SIZES[key]) return NAMED_SIZES[key];
  const px = token.trim();
  const m = /^(\d{1,2})px$/i.exec(px);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 10 || n > 32) return null;
  return `${n}px`;
}

function applyBoldMarkup(input: string): string {
  let s = input;
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  return s;
}

function applyColorMarkup(input: string): string {
  return input.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_full, colorToken, inner) => {
    const color = resolveColor(String(colorToken));
    if (!color) return inner;
    return `<span style="color:${color}">${inner}</span>`;
  });
}

function applySizeMarkup(input: string): string {
  return input.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, (_full, sizeToken, inner) => {
    const size = resolveSize(String(sizeToken));
    if (!size) return inner;
    return `<span style="font-size:${size}">${inner}</span>`;
  });
}

function applyBgMarkup(input: string): string {
  return input.replace(/\[bg=([^\]]+)\]([\s\S]*?)\[\/bg\]/gi, (_full, bgToken, inner) => {
    const color = resolveColor(String(bgToken));
    if (!color) return inner;
    return `<span style="background-color:${color}">${inner}</span>`;
  });
}

function applyNestedMarkup(input: string): string {
  let s = input;
  for (let i = 0; i < 4; i += 1) {
    const next = applyBgMarkup(applySizeMarkup(applyColorMarkup(applyBoldMarkup(s))));
    if (next === s) break;
    s = next;
  }
  return s;
}

/** 줄바꿈·굵기·색·크기·이모지(유니코드)를 안전한 HTML 조각으로 변환 */
export function parseOrderFormModalTextMarkup(raw: string): string {
  const escaped = escapeHtml(raw ?? '');
  const marked = applyNestedMarkup(escaped);
  return marked.replace(/\r\n|\r|\n/g, '<br />');
}

export function wrapOrderFormModalTextSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  openTag: string,
  closeTag: string,
  placeholder = '내용',
): { next: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const inner = selected || placeholder;
  const insert = `${openTag}${inner}${closeTag}`;
  const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
  const start = selectionStart + openTag.length;
  const end = start + inner.length;
  return { next, selectionStart: start, selectionEnd: end };
}

export function insertOrderFormModalTextSnippet(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string,
): { next: string; caret: number } {
  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  const caret = selectionStart + snippet.length;
  return { next, caret };
}
