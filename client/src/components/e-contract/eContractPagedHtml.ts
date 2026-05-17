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

/** iframe srcdoc — paged.js 로 A4 페이지 단위 분할·헤더·푸터 */
export function buildPagedHtmlDocument(opts: {
  bodyHtml: string;
  docId: string;
  pagedScriptUrl: string;
  title: string;
}): string {
  const inner = sanitizeEContractHtml(opts.bodyHtml);
  const docIdSafe = escapeHtml(opts.docId);
  const titleSafe = escapeHtml(opts.title);
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

article.e-contract-body-html {
  word-break: keep-all;
  overflow-wrap: anywhere;
}

article.e-contract-body-html pre.ec-plain-contract {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

article.e-contract-body-html p { margin: 0 0 0.6em 0; }
article.e-contract-body-html p:empty { min-height: 1.65em; }
article.e-contract-body-html p:has(> br:only-child) { min-height: 1em; }

article.e-contract-body-html h1 { font-size: 16pt; font-weight: 700; margin: 0.6em 0 0.4em; page-break-after: avoid; }
article.e-contract-body-html h2 { font-size: 13pt; font-weight: 700; margin: 0.6em 0 0.4em; page-break-after: avoid; }
article.e-contract-body-html h3 { font-size: 11.5pt; font-weight: 600; margin: 0.5em 0 0.3em; page-break-after: avoid; }
article.e-contract-body-html ul, article.e-contract-body-html ol { margin: 0.4em 0 0.6em 1.4em; padding: 0; }
article.e-contract-body-html li { margin: 0.1em 0; }
article.e-contract-body-html blockquote {
  margin: 0.6em 0;
  padding-left: 10px;
  border-left: 3px solid #d1d5db;
  color: #4b5563;
}
article.e-contract-body-html table { border-collapse: collapse; page-break-inside: auto; }
article.e-contract-body-html tr { page-break-inside: avoid; }
article.e-contract-body-html img { max-width: 100%; height: auto; page-break-inside: avoid; }
article.e-contract-body-html a { color: #1d4ed8; text-decoration: underline; }

article.e-contract-body-html .ql-align-center,
article.e-contract-body-html [style*="text-align: center"] { text-align: center; }
article.e-contract-body-html .ql-align-right,
article.e-contract-body-html [style*="text-align: right"] { text-align: right; }
article.e-contract-body-html .ql-align-justify,
article.e-contract-body-html [style*="text-align: justify"] { text-align: justify; }

.ec-party-appendix { page-break-inside: avoid; break-inside: avoid; }

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
<article class="e-contract-body-html">
${inner}
</article>
<script>
  window.PagedConfig = {
    auto: true,
    after: function() {
      try { document.body.setAttribute('data-pagedjs-ready', '1'); } catch (e) {}
      try { window.parent.postMessage({ type: 'pagedjs-rendered' }, '*'); } catch (e) {}
    }
  };
</script>
<script src="${scriptUrlSafe}"></script>
</body>
</html>`;
}

export function buildEContractPagedDownloadFilenameBase(definitionTitle: string, versionOrdinal: number): string {
  const raw = `${(definitionTitle ?? '').trim() || '계약서'}_v${versionOrdinal}`;
  const safe = raw.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return safe.slice(0, 120) || '계약서';
}
