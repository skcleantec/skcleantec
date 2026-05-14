import { useEffect, useMemo, useRef, useState } from 'react';
import { getEContractSubmissionDetail, type EContractSubmissionDetailDto } from '../../api/adminEContract';
import { sanitizeEContractHtml } from '../../utils/sanitizeEContractHtml';

// pagedjs 의 polyfill 은 client/public/vendor/pagedjs/ 에 사본을 두고 절대 URL 로 로드한다.
// (pagedjs@0.4.3 의 package.json `exports` 가 `./dist/*` 를 노출하지 않아 ?url import 가
//  최신 Vite 에서 막힌다. 사본은 npm install / dev / build 직전에 scripts/copy-pagedjs-polyfill.mjs
//  가 자동으로 갱신한다.)
const pagedPolyfillUrl = '/vendor/pagedjs/paged.polyfill.min.js';

type Props = {
  token: string | null;
  submissionId: string | null;
  open: boolean;
  onClose: () => void;
};

function escapeHtml(s: string): string {
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

/** iframe srcdoc — paged.js 로 A4 페이지 단위 분할·헤더·푸터를 직접 그린다 */
function buildPagedHtmlDocument(opts: { bodyHtml: string; docId: string; pagedScriptUrl: string; title: string }): string {
  const inner = sanitizeEContractHtml(opts.bodyHtml);
  const docIdSafe = escapeHtml(opts.docId);
  const titleSafe = escapeHtml(opts.title);
  // 외부 URL (vite 처리됨) — 절대 URL 로 변환해 iframe 안에서도 접근되게 함
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

article.e-contract-body-html p { margin: 0 0 0.6em 0; }
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

/* Quill / Tiptap 정렬 클래스 (iframe 안에는 Tailwind 가 없으므로 직접 처리) */
article.e-contract-body-html .ql-align-center,
article.e-contract-body-html [style*="text-align: center"] { text-align: center; }
article.e-contract-body-html .ql-align-right,
article.e-contract-body-html [style*="text-align: right"] { text-align: right; }
article.e-contract-body-html .ql-align-justify,
article.e-contract-body-html [style*="text-align: justify"] { text-align: justify; }

/* 갑/을 정보 부록은 한 페이지 안에 모이도록 */
.ec-party-appendix { page-break-inside: avoid; break-inside: avoid; }

/* 화면용 — paged.js 가 그린 A4 페이지 카드 스타일 */
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
  // paged.polyfill.js 가 자동 시작되기 전에 후크 등록
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

/**
 * 체결 합본 — iframe + Paged.js
 * - 실제 A4 페이지 단위로 분할된 모습을 그대로 보여줌
 * - 각 페이지에 자동으로 문서 확인 번호(헤더) · 페이지 번호(푸터) 추가
 * - 인쇄/PDF 저장 시에도 동일한 페이지 구분으로 출력
 */
function SubmissionContractReader({
  bodyHtml,
  docId,
  title,
  iframeRef,
  onReadyChange,
}: {
  bodyHtml: string;
  docId: string;
  title: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onReadyChange: (ready: boolean) => void;
}) {
  const docHtml = useMemo(
    () => buildPagedHtmlDocument({ bodyHtml, docId, pagedScriptUrl: pagedPolyfillUrl, title }),
    [bodyHtml, docId, title]
  );

  // iframe 안에서 paged.js 가 페이지 분할을 끝내면 postMessage 로 알림 → 부모는 인쇄 버튼 활성화
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev && ev.data && typeof ev.data === 'object' && ev.data.type === 'pagedjs-rendered') {
        onReadyChange(true);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onReadyChange]);

  // 본문 변경 시 일단 ready=false 로 리셋 + 8초 안전 fallback (paged.js 후크가 실패해도 인쇄 가능하게)
  useEffect(() => {
    onReadyChange(false);
    const fallback = window.setTimeout(() => onReadyChange(true), 8000);
    return () => window.clearTimeout(fallback);
  }, [docHtml, onReadyChange]);

  return (
    <div
      className="w-full overflow-hidden rounded-md border border-gray-200 bg-gray-200"
      style={{ height: 'min(calc(96vh - 14rem), 80vh)' }}
    >
      <iframe
        ref={iframeRef}
        title="계약서 미리보기"
        srcDoc={docHtml}
        sandbox="allow-same-origin allow-scripts allow-modals"
        className="block h-full w-full border-0 bg-gray-200"
      />
    </div>
  );
}

export function AdminEContractSubmissionDetailModal({ token, submissionId, open, onClose }: Props) {
  const [detail, setDetail] = useState<EContractSubmissionDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imageLightboxUrl, setImageLightboxUrl] = useState<string | null>(null);
  const [imageLightboxLabel, setImageLightboxLabel] = useState('');
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [pagedReady, setPagedReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open) {
      setImageLightboxUrl(null);
      setImageLightboxLabel('');
      setReaderExpanded(false);
      setPagedReady(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !token || !submissionId) {
      setDetail(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setDetail(null);
    setPagedReady(false);
    void (async () => {
      try {
        const d = await getEContractSubmissionDetail(token, submissionId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, submissionId]);

  function triggerPrint() {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      window.alert('미리보기가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.alert('인쇄 창을 열지 못했습니다.');
    }
  }

  if (!open) return null;

  const signerEntered =
    detail?.payload &&
    typeof detail.payload === 'object' &&
    detail.payload !== null &&
    'signerEntered' in detail.payload &&
    typeof (detail.payload as { signerEntered?: unknown }).signerEntered === 'object' &&
    (detail.payload as { signerEntered: Record<string, unknown> }).signerEntered !== null
      ? (detail.payload as { signerEntered: Record<string, unknown> }).signerEntered
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ec-submission-modal-title"
        onMouseDown={(ev) => {
          if (ev.target === ev.currentTarget) onClose();
        }}
      >
        <div
          className={`flex w-full flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-xl sm:rounded-lg ${
            readerExpanded && detail
              ? 'h-[96vh] max-h-[96vh] max-w-[min(1180px,99vw)]'
              : 'max-h-[min(94vh,1000px)] max-w-3xl'
          }`}
        >
          <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="ec-submission-modal-title" className="text-fluid-md font-semibold text-gray-900">
                  최종 체결본
                </h2>
                <p className="mt-1 text-fluid-2xs text-gray-600">
                  아래 미리보기는 <span className="font-medium text-gray-800">실제 A4 인쇄 페이지</span>로 분할되어 표시됩니다.
                  각 페이지 머리말에 <span className="font-medium">문서 확인 번호</span>, 꼬리말에 <span className="font-medium">현재/전체 페이지 번호</span>가
                  자동으로 들어갑니다.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-md px-3 py-1.5 text-fluid-sm text-gray-700 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
            {detail && !loading && !err ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={triggerPrint}
                    disabled={!pagedReady}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title="아래 미리보기 그대로 인쇄·PDF 저장 (페이지 번호·문서 번호 포함)"
                  >
                    {pagedReady ? '인쇄 / PDF로 저장' : '페이지 준비 중…'}
                  </button>
                  <button
                    type="button"
                    disabled={!detail.selfieUrl}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => {
                      if (detail.selfieUrl) {
                        setImageLightboxLabel('본인확인 셀카');
                        setImageLightboxUrl(detail.selfieUrl);
                      }
                    }}
                  >
                    셀카 보기
                  </button>
                  <button
                    type="button"
                    disabled={!detail.signatureUrl}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => {
                      if (detail.signatureUrl) {
                        setImageLightboxLabel('서명');
                        setImageLightboxUrl(detail.signatureUrl);
                      }
                    }}
                  >
                    서명 보기
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-fluid-xs font-medium text-blue-900 hover:bg-blue-100"
                    onClick={() => setReaderExpanded((v) => !v)}
                  >
                    {readerExpanded ? '보통 크기' : '문서만 넓게'}
                  </button>
                </div>
                <p className="text-fluid-2xs text-gray-500">
                  ⚠️ 「인쇄 / PDF로 저장」을 누른 뒤 인쇄 대화상자에서 <strong>대상을 「PDF로 저장」</strong>으로 선택하면
                  화면과 동일한 페이지 분할·머리말·꼬리말이 그대로 들어간 PDF가 만들어집니다.
                </p>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-center text-fluid-sm text-gray-500">불러오는 중…</p>
            ) : err ? (
              <p className="text-center text-fluid-sm text-red-700">{err}</p>
            ) : detail ? (
              <div className="space-y-4">
                {!detail.mergedUsed ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900">
                    이 기록에는 체결 시점 합본 HTML이 없습니다. 아래는 해당 버전 계약 원문(갑 치환본)입니다. 신규 체결분은 합본이
                    저장됩니다.
                  </div>
                ) : null}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <div className="text-fluid-sm font-semibold text-gray-900">계약서(제출본)</div>
                      <p className="mt-0.5 text-fluid-2xs text-gray-500">
                        본문·계약 당사자 정보·서명까지 한 문서로 묶여, 실제 A4 페이지 형태로 표시됩니다.
                      </p>
                    </div>
                    <div className="text-fluid-2xs text-gray-500">
                      문서 확인 번호 <span className="font-mono text-gray-700">{detail.id}</span>
                    </div>
                  </div>
                  <div className="mt-2 min-w-0">
                    <SubmissionContractReader
                      bodyHtml={detail.bodyHtml}
                      docId={detail.id}
                      title={`${detail.definitionTitle} - ${detail.teamLeader.name}`}
                      iframeRef={iframeRef}
                      onReadyChange={setPagedReady}
                    />
                  </div>
                </div>

                <details className="group rounded-lg border border-gray-200 bg-gray-50 open:bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-fluid-xs font-medium text-gray-800 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden>▸</span>
                      <span className="group-open:hidden">체결 요약·을 입력·이미지 미리보기 펼치기</span>
                      <span className="hidden group-open:inline">체결 요약·을 입력·이미지 미리보기 접기</span>
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-gray-200 px-3 pb-3 pt-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-fluid-xs text-gray-800">
                      <div>
                        <span className="font-medium">계약 종류</span> — {detail.definitionTitle}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">팀장</span> — {detail.teamLeader.name}{' '}
                        <span className="text-gray-600">({detail.teamLeader.email})</span>
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">버전</span> —{' '}
                        <span className="tabular-nums">{detail.versionOrdinal != null ? `v${detail.versionOrdinal}` : '—'}</span>
                        {detail.versionTitle ? ` · ${detail.versionTitle}` : null}
                      </div>
                      <div className="mt-1">
                        <span className="font-medium">체결 시각</span> —{' '}
                        <span className="tabular-nums">{new Date(detail.signedAt).toLocaleString('ko-KR')}</span>
                      </div>
                      {detail.signerIp ? (
                        <div className="mt-1 break-all text-gray-600">
                          <span className="font-medium text-gray-800">IP</span> — {detail.signerIp}
                        </div>
                      ) : null}
                      {detail.signerUserAgent ? (
                        <div className="mt-1 break-all text-gray-600">
                          <span className="font-medium text-gray-800">UA</span> — {detail.signerUserAgent}
                        </div>
                      ) : null}
                    </div>

                    {signerEntered ? (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className="text-fluid-xs font-medium text-gray-800">을(팀장) 입력 요약</div>
                        <dl className="mt-2 grid gap-1 text-fluid-2xs text-gray-700 sm:grid-cols-2">
                          {typeof signerEntered.name === 'string' ? (
                            <>
                              <dt className="text-gray-500">성함</dt>
                              <dd className="truncate font-medium">{String(signerEntered.name)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.residentRegistrationNumber === 'string' ? (
                            <>
                              <dt className="text-gray-500">주민등록번호</dt>
                              <dd className="font-mono tabular-nums">{String(signerEntered.residentRegistrationNumber)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.addressLine === 'string' ? (
                            <>
                              <dt className="self-start text-gray-500">주소</dt>
                              <dd className="whitespace-pre-wrap break-words">{String(signerEntered.addressLine)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.phone === 'string' ? (
                            <>
                              <dt className="text-gray-500">연락처</dt>
                              <dd className="tabular-nums">{String(signerEntered.phone)}</dd>
                            </>
                          ) : null}
                          {typeof signerEntered.freeTextNotes === 'string' && String(signerEntered.freeTextNotes).trim() ? (
                            <>
                              <dt className="self-start text-gray-500">추가 기재</dt>
                              <dd className="whitespace-pre-wrap break-words">{String(signerEntered.freeTextNotes)}</dd>
                            </>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}

                    {(detail.selfieUrl || detail.signatureUrl) && (
                      <div>
                        <div className="text-fluid-xs font-medium text-gray-800">이미지 미리보기</div>
                        <p className="mt-1 text-fluid-2xs text-gray-500">
                          상단 「셀카 보기」「서명 보기」로 크게 볼 수 있습니다.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4">
                          {detail.selfieUrl ? (
                            <div className="min-w-0">
                              <div className="text-fluid-2xs text-gray-500">셀카</div>
                              <button
                                type="button"
                                className="mt-1 block overflow-hidden rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={() => {
                                  setImageLightboxLabel('본인확인 셀카');
                                  setImageLightboxUrl(detail.selfieUrl);
                                }}
                              >
                                <img
                                  src={detail.selfieUrl}
                                  alt="본인 확인 셀카"
                                  className="max-h-40 w-auto object-contain"
                                />
                              </button>
                            </div>
                          ) : null}
                          {detail.signatureUrl ? (
                            <div className="min-w-0">
                              <div className="text-fluid-2xs text-gray-500">서명</div>
                              <button
                                type="button"
                                className="mt-1 block overflow-hidden rounded border border-gray-200 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={() => {
                                  setImageLightboxLabel('서명');
                                  setImageLightboxUrl(detail.signatureUrl);
                                }}
                              >
                                <img src={detail.signatureUrl} alt="서명" className="max-h-24 w-auto object-contain" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {imageLightboxUrl ? (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={imageLightboxLabel}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) {
              setImageLightboxUrl(null);
              setImageLightboxLabel('');
            }
          }}
        >
          <div className="relative max-h-full max-w-full rounded-lg bg-white p-2 shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-2 pb-2">
              <span className="text-fluid-sm font-medium text-gray-900">{imageLightboxLabel}</span>
              <div className="flex flex-wrap gap-2">
                <a
                  href={imageLightboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-gray-300 px-3 py-1 text-fluid-xs text-gray-800 hover:bg-gray-50"
                >
                  새 탭에서 열기
                </a>
                <button
                  type="button"
                  className="rounded-md bg-gray-900 px-3 py-1 text-fluid-xs font-medium text-white hover:bg-gray-800"
                  onClick={() => {
                    setImageLightboxUrl(null);
                    setImageLightboxLabel('');
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="max-h-[min(80vh,720px)] overflow-auto p-2">
              <img
                src={imageLightboxUrl}
                alt={imageLightboxLabel}
                className="mx-auto max-h-[min(75vh,680px)] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
