import { orderFormModalTextToSafeHtml } from './orderFormModalFormattedText';

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

export const ORDER_FORM_MODAL_VISUAL_FONT_SIZES: Record<string, string> = { ...NAMED_SIZES };

function expandShortHex(hex: string): string {
  if (hex.length !== 4) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function normalizeCssColorToHex(color: string): string | null {
  const c = color.trim();
  if (/^#[0-9a-f]{3}$/i.test(c)) return expandShortHex(c.toLowerCase());
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const m = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]]
    .map((n) => parseInt(n, 10).toString(16).padStart(2, '0'))
    .join('')}`;
}

function cssColorToMarkupToken(color: string): string | null {
  const hex = normalizeCssColorToHex(color);
  if (!hex) return null;
  for (const [name, val] of Object.entries(NAMED_COLORS)) {
    if (val.toLowerCase() === hex) return name;
  }
  return hex;
}

function fontSizeToMarkupToken(size: string): string {
  const normalized = size.trim().toLowerCase();
  for (const [key, val] of Object.entries(NAMED_SIZES)) {
    if (val === normalized) return key;
  }
  if (/^\d+px$/i.test(normalized)) return normalized;
  return normalized;
}

function serializeChildren(el: HTMLElement): string {
  return Array.from(el.childNodes).map((node) => serializeNode(node)).join('');
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  if (tag === 'strong' || tag === 'b') return `[b]${serializeChildren(el)}[/b]`;
  if (tag === 'span') {
    const inner = serializeChildren(el);
    const color = el.style.color;
    const bg = el.style.backgroundColor;
    const fs = el.style.fontSize;
    if (color) {
      const tok = cssColorToMarkupToken(color);
      if (tok) return `[color=${tok}]${inner}[/color]`;
    }
    if (bg) {
      const tok = cssColorToMarkupToken(bg);
      if (tok) return `[bg=${tok}]${inner}[/bg]`;
    }
    if (fs) return `[size=${fontSizeToMarkupToken(fs)}]${inner}[/size]`;
    return inner;
  }
  if (tag === 'div' || tag === 'p') return serializeChildren(el);
  return serializeChildren(el);
}

export function serializeOrderFormModalEditorRoot(root: HTMLElement): string {
  const parts: string[] = [];
  const nodes = Array.from(root.childNodes);
  nodes.forEach((node, index) => {
    parts.push(serializeNode(node));
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      if ((tag === 'div' || tag === 'p') && index < nodes.length - 1) parts.push('\n');
    }
  });
  return parts.join('').replace(/\u00a0/g, ' ');
}

export function orderFormModalMarkupToEditorHtml(markup: string): string {
  const trimmed = (markup ?? '').trim();
  if (!trimmed) return '';
  return orderFormModalTextToSafeHtml(trimmed);
}

export function getRangeInEditor(root: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  return range;
}

function wrapRangeWithStyledSpan(range: Range, style: Partial<CSSStyleDeclaration>): void {
  const span = document.createElement('span');
  if (style.color) span.style.color = style.color;
  if (style.backgroundColor) span.style.backgroundColor = style.backgroundColor;
  if (style.fontSize) span.style.fontSize = style.fontSize;
  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  const sel = window.getSelection();
  sel?.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(span);
  next.collapse(false);
  sel?.addRange(next);
}

export function applyBoldInEditor(root: HTMLElement): void {
  root.focus();
  document.execCommand('bold');
}

export function applyTextColorInEditor(root: HTMLElement, hex: string): void {
  root.focus();
  const range = getRangeInEditor(root);
  if (!range || range.collapsed) {
    document.execCommand('insertText', false, '내용');
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    r.setStart(r.startContainer, Math.max(0, r.startOffset - 2));
    wrapRangeWithStyledSpan(r, { color: hex });
    return;
  }
  wrapRangeWithStyledSpan(range, { color: hex });
}

export function applyBgColorInEditor(root: HTMLElement, hex: string): void {
  root.focus();
  const range = getRangeInEditor(root);
  if (!range || range.collapsed) {
    document.execCommand('insertText', false, '내용');
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    r.setStart(r.startContainer, Math.max(0, r.startOffset - 2));
    wrapRangeWithStyledSpan(r, { backgroundColor: hex });
    return;
  }
  wrapRangeWithStyledSpan(range, { backgroundColor: hex });
}

export function applyFontSizeInEditor(root: HTMLElement, sizeKey: string): void {
  const fontSize = ORDER_FORM_MODAL_VISUAL_FONT_SIZES[sizeKey] ?? sizeKey;
  root.focus();
  const range = getRangeInEditor(root);
  if (!range || range.collapsed) {
    document.execCommand('insertText', false, '내용');
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    r.setStart(r.startContainer, Math.max(0, r.startOffset - 2));
    wrapRangeWithStyledSpan(r, { fontSize });
    return;
  }
  wrapRangeWithStyledSpan(range, { fontSize });
}

export function insertTextInEditor(root: HTMLElement, text: string): void {
  root.focus();
  document.execCommand('insertText', false, text);
}
