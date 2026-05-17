import { useEffect, useMemo, useRef, useState } from 'react';
import { EContractPagedIframeReader } from './EContractPagedIframeReader';
import { normalizeContractBodyForPaged } from './eContractPagedHtml';
import { downloadPagedIframeAsPdf } from './downloadPagedIframePdf';

type Props = {
  open: boolean;
  onClose: () => void;
  bodyRaw: string;
  docId: string;
  definitionTitle: string;
  versionOrdinal: number;
  /** 미리보기 준비 후 PDF 파일을 자동으로 저장(인쇄 창 없음) */
  autoDownloadPdfOnReady?: boolean;
  onAutoDownloadPdfConsumed?: () => void;
};

export function EContractPagedPreviewModal({
  open,
  onClose,
  bodyRaw,
  docId,
  definitionTitle,
  versionOrdinal,
  autoDownloadPdfOnReady,
  onAutoDownloadPdfConsumed,
}: Props) {
  const [pagedReady, setPagedReady] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const normalizedBody = useMemo(() => normalizeContractBodyForPaged(bodyRaw), [bodyRaw]);
  const readerTitle = useMemo(
    () => `${definitionTitle || '계약서'} · v${versionOrdinal}`,
    [definitionTitle, versionOrdinal]
  );
  const pdfFilenameBase = useMemo(
    () => `${definitionTitle || '계약서'}_v${versionOrdinal}_${docId}`,
    [definitionTitle, versionOrdinal, docId]
  );

  useEffect(() => {
    if (!open) {
      setPagedReady(false);
      setPdfBusy(false);
    }
  }, [open]);

  async function runPdfDownload(): Promise<void> {
    if (!pagedReady || pdfBusy) return;
    setPdfBusy(true);
    try {
      await downloadPagedIframeAsPdf(iframeRef.current, pdfFilenameBase);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'PDF를 저장하지 못했습니다.');
    } finally {
      setPdfBusy(false);
    }
  }

  const autoPdfDoneRef = useRef(false);
  useEffect(() => {
    if (!open) autoPdfDoneRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || !autoDownloadPdfOnReady || !pagedReady || autoPdfDoneRef.current) return;
    autoPdfDoneRef.current = true;
    void (async () => {
      try {
        await downloadPagedIframeAsPdf(iframeRef.current, pdfFilenameBase);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'PDF를 저장하지 못했습니다.');
      } finally {
        onAutoDownloadPdfConsumed?.();
      }
    })();
  }, [open, autoDownloadPdfOnReady, pagedReady, pdfFilenameBase, onAutoDownloadPdfConsumed]);

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
                실제 A4 인쇄 페이지로 분할된 모습입니다. 「PDF로 저장」 시 브라우저에서 파일로 바로 받습니다.
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
                onClick={() => void runPdfDownload()}
                disabled={!pagedReady || pdfBusy}
                className="rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!pagedReady ? '페이지 준비 중…' : pdfBusy ? 'PDF 생성 중…' : 'PDF로 저장'}
              </button>
            </div>
            <p className="text-fluid-2xs text-gray-500">
              페이지가 많으면 잠시 걸릴 수 있습니다. 외부 이미지(도장·서명)는 출처 사이트 CORS 설정에 따라 일부 생략될 수 있습니다.
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
