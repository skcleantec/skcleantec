import { eContractBodyLooksLikeHtml, sanitizeEContractHtml } from '../../utils/sanitizeEContractHtml';

export const PAGED_POLYFILL_URL = '/vendor/pagedjs/paged.polyfill.min.js';

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

/** 계약 본문(HTML 또는 레거시 플레인)을 Paged 본문으로 넣기 위한 정규화 */
export function normalizeContractBodyForPaged(raw: string): string {
  const t = (raw ?? '').trim();
  if (!t) return '<p>(비어 있음)</p>';
  if (eContractBodyLooksLikeHtml(t)) return t;
  return `<pre class="ec-plain-contract">${escapeHtml(t)}</pre>`;
}

/** PDF·미리보기 부록 원본 보관 — Paged.js 후 article 에서는 사라질 수 있음 */
export const EC_APPENDIX_SOURCE_ID = 'ec-appendix-source';

export function readAppendixSourceHtml(doc: Document): string | null {
  const tpl = doc.getElementById(EC_APPENDIX_SOURCE_ID) as HTMLTemplateElement | null;
  if (!tpl) return null;
  const html = (tpl.innerHTML ?? '').trim();
  return html || null;
}

/** PDF 부록·Paged.js after() 주입용 — 갑·을 부록 블록 분리 */
export function splitContractMainAndPartyAppendix(html: string): { main: string; appendix: string | null } {
  const t = (html ?? '').trim();
  if (!t) return { main: '', appendix: null };
  const re = /<div\b[^>]*\bec-party-appendix\b/i;
  const m = re.exec(t);
  if (!m || m.index == null) return { main: t, appendix: null };
  return {
    main: t.slice(0, m.index).trimEnd(),
    appendix: t.slice(m.index).trim(),
  };
}

/** iframe srcdoc — paged.js 로 A4 페이지 단위 분할·헤더·푸터 (체결·관리자 미리보기 공통) */
export function buildPagedHtmlDocument(opts: {
  bodyHtml: string;
  docId: string;
  pagedScriptUrl: string;
  title: string;
}): string {
  const sanitized = sanitizeEContractHtml(opts.bodyHtml);
  const { main, appendix } = splitContractMainAndPartyAppendix(sanitized);
  const inner = (main || sanitized).trim();
  const docIdSafe = escapeHtml(opts.docId);
  const titleSafe = escapeHtml(opts.title);
  const appendixJson = JSON.stringify(appendix ?? '');
  const absoluteScriptUrl = (() => {
    try {
      return new URL(opts.pagedScriptUrl, window.location.href).toString();
    } catch {
      return opts.pagedScriptUrl;
    }
  })();
  const scriptUrlSafe = escapeHtml(absoluteScriptUrl);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${titleSafe}</title>
<style>
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
  @top-right {
    content: "문서 확인 번호 ${docIdSafe}";
    font-family: 'Malgun Gothic','맑은 고딕',sans-serif;
    font-size: 8pt;
    color: #666;
  }
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-family: 'Malgun Gothic','맑은 고딕',sans-serif;
    font-size: 9pt;
    color: #333;
  }
}

html, body {
  margin: 0;
  padding: 0;
  font-family: 'Malgun Gothic','맑은 고딕','Noto Sans KR',sans-serif;
  color: #111827;
  line-height: 1.65;
  font-size: 11pt;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

article.e-contract-body-html,
.pagedjs_page_content,
.ec-pdf-appendix-capture-root {
  word-break: keep-all;
  overflow-wrap: anywhere;
}

article.e-contract-body-html pre.ec-plain-contract,
.pagedjs_page_content pre.ec-plain-contract {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

article.e-contract-body-html p,
.pagedjs_page_content p { margin: 0 0 0.6em 0; }
article.e-contract-body-html p:empty,
.pagedjs_page_content p:empty { min-height: 1.65em; }

article.e-contract-body-html h1,
.pagedjs_page_content h1 { font-size: 16pt; font-weight: 700; margin: 0.6em 0 0.4em; page-break-after: avoid; }
article.e-contract-body-html h2,
.pagedjs_page_content h2 { font-size: 13pt; font-weight: 700; margin: 0.6em 0 0.4em; page-break-after: avoid; }
article.e-contract-body-html h3,
.pagedjs_page_content h3 { font-size: 11.5pt; font-weight: 600; margin: 0.5em 0 0.3em; page-break-after: avoid; }
article.e-contract-body-html table,
.pagedjs_page_content table,
.ec-pdf-appendix-capture-root table { border-collapse: collapse; page-break-inside: auto; width: 100%; }
article.e-contract-body-html th,
article.e-contract-body-html td,
.pagedjs_page_content th,
.pagedjs_page_content td,
.ec-pdf-appendix-capture-root th,
.ec-pdf-appendix-capture-root td {
  border: 1px solid #d1d5db;
  padding: 6px 8px;
  vertical-align: top;
  word-break: break-word;
}
article.e-contract-body-html img,
.pagedjs_page_content img,
.ec-pdf-appendix-capture-root img {
  max-width: 100%;
  height: auto;
  page-break-inside: avoid;
}

/* avoid 는 큰 부록이 Paged.js에서 페이지 밖으로 밀려 PDF에서 빠지기 쉬움 */
.ec-party-appendix {
  break-inside: auto;
  page-break-inside: auto;
}

@media screen {
  body {
    background: #e5e7eb;
  }
  .pagedjs_pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px 0 24px;
  }
  .pagedjs_page {
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06);
  }
}
</style>
</head>
<body>
${appendix ? `<template id="${EC_APPENDIX_SOURCE_ID}">${appendix}</template>` : ''}
<article class="e-contract-body-html">
${inner}
</article>
<script>
  window.PagedConfig = {
    auto: true,
    after: function() {
      var appendixHtml = ${appendixJson};

      function enableCorsImages(root) {
        var scope = root || document;
        scope.querySelectorAll('img[src]').forEach(function(img) {
          if (img.getAttribute('data-ec-cors') === '1') return;
          img.setAttribute('crossorigin', 'anonymous');
          img.setAttribute('data-ec-cors', '1');
          try {
            var s = img.currentSrc || img.src;
            if (s) { img.src = ''; img.src = s; }
          } catch (e) {}
        });
      }

      function injectAppendixDedicatedPage() {
        if (!appendixHtml) return;
        var pagesRoot = document.querySelector('.pagedjs_pages');
        if (!pagesRoot) return;
        pagesRoot.querySelectorAll('[data-ec-appendix-injected="1"]').forEach(function(node) {
          node.remove();
        });
        var template = pagesRoot.querySelector('.pagedjs_page:not([data-ec-appendix-injected])');
        if (!template) return;
        var page = template.cloneNode(true);
        page.setAttribute('data-ec-appendix-injected', '1');
        var content = page.querySelector('.pagedjs_page_content');
        var target = content || page.querySelector('.pagedjs_pagebox') || page;
        target.innerHTML = appendixHtml;
        pagesRoot.appendChild(page);
        enableCorsImages(page);
      }

      try { enableCorsImages(document); } catch (e) {}
      try { injectAppendixDedicatedPage(); } catch (e) {}
      try { document.body.setAttribute('data-pagedjs-ready', '1'); } catch (e) {}
      try { window.parent.postMessage({ type: 'pagedjs-rendered' }, '*'); } catch (e) {}
    }
  };
</script>
<script src="${scriptUrlSafe}"></script>
</body>
</html>`;
}
