import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { downloadQuotationPdf } from '../../api/quotations';
import { downloadTeamQuotationPdf } from '../../api/teamQuotations';
import { qUi } from './quotationUi';

type Props = {
  token: string;
  quotationId: string | null;
  quoteNumber: string | null;
  disabled?: boolean;
  /** admin: /api/quotations, team: /api/team/quotations */
  apiScope?: 'admin' | 'team';
};

function toPdfBlob(blob: Blob): Blob {
  if (blob.type === 'application/pdf') return blob;
  return new Blob([blob], { type: 'application/pdf' });
}

export function QuotationPdfActions({ token, quotationId, quoteNumber, disabled, apiScope = 'admin' }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearPreviewUrl = useCallback(() => {
    const current = previewUrlRef.current;
    if (current) {
      URL.revokeObjectURL(current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const closePreview = useCallback(() => {
    clearPreviewUrl();
    setPreviewOpen(false);
    setError(null);
  }, [clearPreviewUrl]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) closePreview();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [previewOpen, loading, closePreview]);

  const downloadPdf =
    apiScope === 'team'
      ? (t: string, id: string, opts?: { preview?: boolean }) => downloadTeamQuotationPdf(t, id, opts)
      : downloadQuotationPdf;

  async function handlePreview() {
    if (!token || !quotationId) {
      alert('먼저 저장해 주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    clearPreviewUrl();
    setPreviewOpen(true);
    try {
      const blob = await downloadPdf(token, quotationId, { preview: true });
      if (blob.size <= 0) {
        throw new Error('PDF 데이터가 비어 있습니다.');
      }
      const url = URL.createObjectURL(toPdfBlob(blob));
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      setPreviewOpen(false);
      const message = e instanceof Error ? e.message : '미리보기에 실패했습니다.';
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!token || !quotationId) {
      alert('먼저 저장해 주세요.');
      return;
    }
    setLoading(true);
    try {
      const blob = await downloadPdf(token, quotationId);
      const url = URL.createObjectURL(toPdfBlob(blob));
      const a = document.createElement('a');
      a.href = url;
      a.download = `견적서_${quoteNumber ?? quotationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PDF 다운로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (!quotationId) return null;

  const btnCls = `${qUi.btnSecondary} min-h-11 flex-1 py-2.5 touch-manipulation lg:min-h-0 lg:flex-none lg:py-1.5`;

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-wrap">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void handlePreview()}
          className={btnCls}
        >
          {loading && previewOpen ? '만드는 중…' : 'PDF 미리보기'}
        </button>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => void handleDownload()}
          className={btnCls}
        >
          PDF 다운로드
        </button>
      </div>

      {previewOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="modal-mobile-safe-overlay fixed inset-0 z-[90] flex flex-col bg-slate-900"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quotation-pdf-preview-title"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
                <h2
                  id="quotation-pdf-preview-title"
                  className="min-w-0 flex-1 truncate text-fluid-sm font-semibold text-white"
                >
                  PDF 미리보기{quoteNumber ? ` · ${quoteNumber}` : ''}
                </h2>
                <button
                  type="button"
                  disabled={loading}
                  onClick={closePreview}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-white px-3.5 text-fluid-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-50"
                >
                  닫기
                </button>
              </div>
              <div className="relative min-h-0 flex-1 bg-slate-200">
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-fluid-sm text-slate-600">
                    PDF 만드는 중…
                  </div>
                ) : null}
                {previewUrl && !loading ? (
                  <iframe
                    title="견적서 PDF 미리보기"
                    src={`${previewUrl}#view=FitH&toolbar=1`}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                  />
                ) : null}
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleDownload()}
                  className={`${qUi.btnPrimary} min-h-10 touch-manipulation`}
                >
                  다운로드
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {error && !previewOpen ? <span className="text-fluid-2xs text-rose-600">{error}</span> : null}
    </>
  );
}
