import { useEffect, useMemo } from 'react';
import { buildPagedHtmlDocument, PAGED_POLYFILL_URL } from './eContractPagedHtml';

/**
 * 체결 합본 / 계약 본문 — iframe + Paged.js (관리자 체결 상세·팀장 서명 화면 공통)
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
    function onMsg(ev: MessageEvent) {
      if (ev && ev.data && typeof ev.data === 'object' && ev.data.type === 'pagedjs-rendered') {
        onReadyChange(true);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onReadyChange]);

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
