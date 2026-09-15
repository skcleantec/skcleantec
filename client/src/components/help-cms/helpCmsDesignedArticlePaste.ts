import {
  DESIGNED_ARTICLE_FALLBACK_CSS,
  DESIGNED_ARTICLE_FONT_LINK,
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
      const scoped = sel
        .split(',')
        .map((part) => {
          const s = part.trim();
          if (!s) return s;
          if (s === '*' || s === 'html' || s === 'body') return scope;
          if (s.startsWith(scope)) return s;
          return `${scope} ${s}`;
        })
        .join(', ');
      out += `${scoped}{${body}}`;
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
  const hintHits = CLASS_HINTS.filter((h) => h !== DESIGNED_ARTICLE_SCOPE_CLASS && hasClassHint(t, h)).length;
  const hasLead = /class=["'][^"']*\blead\b/i.test(t);
  const hasCta = /class=["'][^"']*\bcta\b/i.test(t);
  const hasStyle = /<style[\s>]/i.test(t);
  const hasDoc = /<!DOCTYPE|<html[\s>]|<body[\s>]/i.test(t);
  if (hasLead && hasCta) return true;
  if (hintHits >= 2) return true;
  if (hasStyle && (hintHits >= 1 || hasLead || /class=["'][^"']*\b(tip|faq|cta)\b/i.test(t))) return true;
  if (hasDoc && hasStyle && /class=/.test(t) && t.length > 800) return true;
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

export function designedArticleHasLocalImages(html: string): boolean {
  return /<img\b[^>]*\bsrc=["'](?!https?:|data:|blob:)[^"']+/i.test(html);
}

export function isPackagedDesignedArticleHtml(html: string): boolean {
  return String(html ?? '').includes(DESIGNED_ARTICLE_SCOPE_CLASS);
}

/** 완성본 HTML → 공지에 저장할 한 덩어리 (style + 본문). 해당 없으면 null. */
export function tryPackageDesignedArticle(raw: string): string | null {
  const text = String(raw ?? '').trim();
  if (!text || !looksLikeDesignedArticleHtml(text)) return null;

  if (isPackagedDesignedArticleHtml(text) && /<style[\s>]/i.test(text)) {
    return text;
  }

  const styleSrc = extractStyleBlocks(text);
  const scopedCss = styleSrc.trim()
    ? scopeDesignedArticleCss(styleSrc)
    : DESIGNED_ARTICLE_FALLBACK_CSS;
  let body = extractDesignedArticleBodyHtml(text);
  body = body.replace(/<style[\s\S]*?<\/style>/gi, '').trim();
  if (!body) return null;

  return [
    DESIGNED_ARTICLE_FONT_LINK,
    `<style>${scopedCss}</style>`,
    `<div class="${DESIGNED_ARTICLE_SCOPE_CLASS}">`,
    body,
    '</div>',
  ].join('');
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
