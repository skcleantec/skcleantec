import { useEffect, useMemo } from 'react';
import { buildPagedHtmlDocument, PAGED_POLYFILL_URL } from './eContractPagedHtml';
import { contractHtmlExpectsPartyAppendix } from './eContractPagedCaptureWait';

/**
 * 체결 합본 / 계약 본문 — iframe + Paged.js (관리자 체결 상세·팀장 서명 화면 공통)
 *
 * 준비 완료 신호는 postMessage/맹목적 타임아웃 대신 DOM 폴링으로만 판단합니다.
 * Paged.js가 페이지를 쪼근 뒤에야 `.pagedjs_pages` 안에 갑·을 부록이 붙는 경우가 있어,
 * 너무 이르면 PDF 첫 저장 시 부록이 빠집니다.
 */
export function EContractPagedIframeReader({
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
    () => buildPagedHtmlDocument({ bodyHtml, docId, pagedScriptUrl: PAGED_POLYFILL_URL, title }),
    [bodyHtml, docId, title]
  );

  useEffect(() => {
    onReadyChange(false);

    let cancelled = false;
    const iv = window.setInterval(() => {
      if (cancelled) return;
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.body) return;

      const pages = doc.querySelectorAll('.pagedjs_pages .pagedjs_page');
      if (pages.length === 0) return;

      if (contractHtmlExpectsPartyAppendix(doc)) {
        const ap =
          doc.querySelector('.pagedjs_pages .ec-party-appendix') ||
          doc.querySelector('.ec-appendix-dedicated-page .ec-party-appendix');
        const h = ap?.getBoundingClientRect().height ?? 0;
        if (!ap || h < 12) return;
      }

      onReadyChange(true);
      window.clearInterval(iv);
    }, 100);

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      onReadyChange(true);
      window.clearInterval(iv);
    }, 22000);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.clearTimeout(timeout);
    };
  }, [docHtml, onReadyChange, iframeRef]);

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
