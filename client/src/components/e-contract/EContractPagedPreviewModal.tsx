import { useEffect, useMemo, useRef, useState } from 'react';
import { EContractPagedIframeReader } from './EContractPagedIframeReader';
import { normalizeContractBodyForPaged } from './eContractPagedHtml';

type Props = {
  open: boolean;
  onClose: () => void;
  bodyRaw: string;
  docId: string;
  definitionTitle: string;
  versionOrdinal: number;
  /** 인쇄 전용으로 모달을 연 경우 true → 페이지 준비 후 자동 인쇄 대화상자 */
  autoPrintOnReady?: boolean;
  onAutoPrintConsumed?: () => void;
};

export function EContractPagedPreviewModal({
  open,
  onClose,
  bodyRaw,
  docId,
  definitionTitle,
  versionOrdinal,
  autoPrintOnReady,
  onAutoPrintConsumed,
}: Props) {
  const [pagedReady, setPagedReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const normalizedBody = useMemo(() => normalizeContractBodyForPaged(bodyRaw), [bodyRaw]);
  const readerTitle = useMemo(
    () => `${definitionTitle || '계약서'} · v${versionOrdinal}`,
    [definitionTitle, versionOrdinal]
  );

  useEffect(() => {
    if (!open) {
      setPagedReady(false);
    }
  }, [open]);

  function triggerPrint() {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
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

  const autoPrintDoneRef = useRef(false);
  useEffect(() => {
    if (!open) autoPrintDoneRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || !autoPrintOnReady || !pagedReady || autoPrintDoneRef.current) return;
    autoPrintDoneRef.current = true;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      onAutoPrintConsumed?.();
      return;
    }
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      /* ignore */
    }
    onAutoPrintConsumed?.();
  }, [open, autoPrintOnReady, pagedReady, onAutoPrintConsumed]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ec-paged-preview-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(94vh,1000px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-xl sm:rounded-lg">
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="ec-paged-preview-title" className="text-fluid-md font-semibold text-gray-900">
                계약서 미리보기 (A4)
              </h2>
              <p className="mt-1 text-fluid-2xs text-gray-600">
                실제 A4 인쇄 페이지로 분할된 모습입니다. 머리말에 문서 확인 번호, 꼬리말에 페이지 번호가 들어갑니다.
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={triggerPrint}
                disabled={!pagedReady}
                className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                title="인쇄 대화상자에서 대상을 PDF로 저장하면 A4 분할·머리말·꼬리말이 그대로 반영됩니다"
              >
                {pagedReady ? 'PDF로 저장' : '페이지 준비 중…'}
              </button>
            </div>
            <p className="text-fluid-2xs text-gray-500">
              「PDF로 저장」을 누른 뒤 인쇄 창에서 <strong className="font-medium text-gray-700">대상을 「PDF로 저장」</strong>
              으로 선택하세요. 실제 프린터로 인쇄할 때도 같은 버튼을 사용할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="text-fluid-2xs text-gray-500">
            문서 확인 번호 <span className="font-mono text-gray-700">{docId}</span>
          </div>
          <div className="mt-2 min-w-0">
            <EContractPagedIframeReader
              bodyHtml={normalizedBody}
              docId={docId}
              title={readerTitle}
              iframeRef={iframeRef}
              onReadyChange={setPagedReady}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
