import {
  DESIGNED_ARTICLE_FALLBACK_CSS,
  DESIGNED_ARTICLE_FONT_LINK,
  DESIGNED_ARTICLE_GENERIC_LAYOUT_CSS,
  DESIGNED_ARTICLE_SCOPE_CLASS,
} from './helpCmsDesignedArticleCss';

const CLASS_HINTS = [
  'post-title',
  'before-after',
  'hashtag-box',
  'ba-box',
  'ba-before',
  'ba-after',
  DESIGNED_ARTICLE_SCOPE_CLASS,
];

function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

/** :root 변수·* 리셋이 공지 칸 안에서만 먹고, 버튼·링크 색이 살아 있게 */
export function scopeSelectorList(sel: string, scope: string): string {
  return sel
    .split(',')
    .map((part) => {
      const s = part.trim();
      if (!s) return s;
      if (s.startsWith(scope)) return s;
      if (s === ':root' || s === 'html' || s === 'body' || s === ':host') return scope;
      if (s === '*') return `${scope}, ${scope} *`;
      if (/^:root\b/.test(s)) return s.replace(/^:root\b/, scope);
      if (/^(html|body)\b/.test(s)) return s.replace(/^(html|body)\b/, scope);
      return `${scope} ${s}`;
    })
    .join(', ');
}

/** 붙여넣은 &lt;style&gt;의 * / body 리셋이 관리 화면을 깨지 않게 */
export function scopeDesignedArticleCss(css: string, scope = `.${DESIGNED_ARTICLE_SCOPE_CLASS}`): string {
  let out = '';
  let i = 0;
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i] ?? '')) {
      out += src[i];
      i += 1;
    }
    if (i >= src.length) break;

    if (src.startsWith('@media', i)) {
      const brace = src.indexOf('{', i);
      if (brace < 0) {
        out += src.slice(i);
        break;
      }
      const end = findMatchingBrace(src, brace);
      const prelude = src.slice(i, brace);
      const inner = src.slice(brace + 1, end);
      out += `${prelude}{${scopeDesignedArticleCss(inner, scope)}}`;
      i = end + 1;
      continue;
    }

    if (src[i] === '@') {
      const brace = src.indexOf('{', i);
      if (brace < 0) {
        out += src.slice(i);
        break;
      }
      const end = findMatchingBrace(src, brace);
      out += src.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    const brace = src.indexOf('{', i);
    if (brace < 0) {
      out += src.slice(i);
      break;
    }
    const sel = src.slice(i, brace).trim();
    const end = findMatchingBrace(src, brace);
    const body = src.slice(brace + 1, end);
    if (sel) {
      out += `${scopeSelectorList(sel, scope)}{${body}}`;
    }
    i = end + 1;
  }
  return out;
}

function hasClassHint(html: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`class=["'][^"']*\\b${escaped}\\b`, 'i').test(html);
}

export function looksLikeDesignedArticleHtml(raw: string): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return false;
  if (t.includes(DESIGNED_ARTICLE_SCOPE_CLASS)) return true;
  if (/<style[\s>]/i.test(t)) return true;
  if (/<table[\s>]|<td[\s>]|<th[\s>]/i.test(t)) return true;
  if (/background(-color)?\s*:/i.test(t)) return true;
  if (/\bstyle\s*=\s*["'][^"']{8,}/i.test(t)) return true;
  if (/<!DOCTYPE\s+html|<html[\s>]/i.test(t) && /<(div|section|table|h1|article)\b/i.test(t)) return true;
  if ((t.match(/<div\b/gi) ?? []).length >= 2 && /(class|style)=/i.test(t)) return true;
  const hintHits = CLASS_HINTS.filter((h) => h !== DESIGNED_ARTICLE_SCOPE_CLASS && hasClassHint(t, h)).length;
  const hasLead = /class=["'][^"']*\blead\b/i.test(t);
  const hasCta = /class=["'][^"']*\bcta\b/i.test(t);
  if (hasLead && hasCta) return true;
  if (hintHits >= 1) return true;
  return false;
}

export function extractDesignedArticleBodyHtml(raw: string): string {
  let t = String(raw ?? '').replace(/\r\n/g, '\n');
  t = t.replace(/^[\s\S]*?<!--StartFragment-->/i, '');
  t = t.replace(/<!--EndFragment-->[\s\S]*$/i, '');
  const body = t.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body?.[1]) t = body[1];
  t = t.replace(/<head[\s\S]*?<\/head>/gi, '');
  t = t.replace(/<\/?html[^>]*>/gi, '');
  t = t.replace(/<\/?body[^>]*>/gi, '');
  t = t.replace(/<!DOCTYPE[^>]*>/gi, '');
  return t.trim();
}

function extractStyleBlocks(raw: string): string {
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1]?.trim()) blocks.push(m[1]);
  }
  return blocks.join('\n');
}

function extractStylesheetLinks(raw: string): string[] {
  const links: string[] = [];
  const re = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[0] && !links.includes(m[0])) links.push(m[0]);
  }
  return links;
}

function extractJsonLdScripts(raw: string): string[] {
  const blocks: string[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[0]) blocks.push(m[0]);
  }
  return blocks;
}

function hasOwnDesignedCss(css: string): boolean {
  return /:root\b|\.wrap\b|\.hero\b|\.toc\b|\.kakao-zone\b/.test(css);
}

export function designedArticleHasLocalImages(html: string): boolean {
  return /<img\b[^>]*\bsrc=["'](?!https?:|data:|blob:)[^"']+/i.test(html);
}

export function isPackagedDesignedArticleHtml(html: string): boolean {
  return String(html ?? '').includes(DESIGNED_ARTICLE_SCOPE_CLASS);
}

/** 완성본 HTML → 공지에 저장할 한 덩어리 (style + 본문). 해당 없으면 null. */
export function tryPackageDesignedArticle(raw: string, force = false): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!force && !looksLikeDesignedArticleHtml(text)) return null;

  if (isPackagedDesignedArticleHtml(text) && /<style[\s>]/i.test(text)) {
    return text.replace(
      new RegExp(`\\.${DESIGNED_ARTICLE_SCOPE_CLASS} :root\\b`, 'g'),
      `.${DESIGNED_ARTICLE_SCOPE_CLASS}`,
    );
  }

  const styleSrc = extractStyleBlocks(text);
  const scopedFromSource = styleSrc.trim() ? scopeDesignedArticleCss(styleSrc) : '';
  const ownCss = hasOwnDesignedCss(styleSrc);
  const scopedCss = (
    ownCss
      ? [scopedFromSource]
      : [DESIGNED_ARTICLE_GENERIC_LAYOUT_CSS, scopedFromSource, DESIGNED_ARTICLE_FALLBACK_CSS]
  )
    .filter(Boolean)
    .join('\n');
  let body = extractDesignedArticleBodyHtml(text);
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, '');
  body = body.trim();
  if (!body) return null;

  const links = extractStylesheetLinks(text);
  const jsonLd = extractJsonLdScripts(text);
  const fontAlready = [...links, DESIGNED_ARTICLE_FONT_LINK].some((l) => /pretendard/i.test(l));

  return [
    fontAlready ? '' : DESIGNED_ARTICLE_FONT_LINK,
    ...links,
    scopedCss ? `<style>${scopedCss}</style>` : '',
    ...jsonLd,
    `<div class="${DESIGNED_ARTICLE_SCOPE_CLASS}">`,
    body,
    '</div>',
  ]
    .filter(Boolean)
    .join('');
}

type EditorLike = {
  getHTML: () => string;
  state: {
    doc: {
      descendants: (fn: (node: { type: { name: string }; attrs: Record<string, unknown> }) => void) => void;
      forEach: (fn: (node: { type: { name: string }; content: { size: number } }) => void) => void;
    };
  };
};

/** TipTap getHTML()은 원본 style을 비우므로, 설계글 블록은 attrs.html을 쓴다. */
export function serializeEditorHtmlWithDesigned(editor: EditorLike): string {
  const designed: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'designedArticle' && typeof node.attrs.html === 'string' && node.attrs.html) {
      designed.push(node.attrs.html);
    }
  });
  if (designed.length === 1) {
    let onlyDesigned = true;
    editor.state.doc.forEach((node) => {
      if (node.type.name === 'designedArticle') return;
      if (node.type.name === 'paragraph' && node.content.size === 0) return;
      onlyDesigned = false;
    });
    if (onlyDesigned) return designed[0];
  }
  if (designed.length > 0) {
    let html = editor.getHTML();
    for (const block of designed) {
      html = html.replace(/<div[^>]*data-designed-article="1"[^>]*>\s*<\/div>/i, block);
    }
    return html;
  }
  return editor.getHTML();
}
