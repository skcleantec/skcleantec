import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadQuotationPdf } from '../../api/quotations';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { qUi } from './quotationUi';

type Props = {
  token: string;
  quotationId: string | null;
  quoteNumber: string | null;
  disabled?: boolean;
};

function toPdfBlob(blob: Blob): Blob {
  if (blob.type === 'application/pdf') return blob;
  return new Blob([blob], { type: 'application/pdf' });
}

export function QuotationPdfActions({ token, quotationId, quoteNumber, disabled }: Props) {
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

  function closePreview() {
    clearPreviewUrl();
    setPreviewOpen(false);
    setError(null);
  }

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
      const blob = await downloadQuotationPdf(token, quotationId, { preview: true });
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
      const blob = await downloadQuotationPdf(token, quotationId);
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

  return (
    <>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => void handlePreview()}
        className={qUi.btnSecondary}
      >
        PDF 미리보기
      </button>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => void handleDownload()}
        className={qUi.btnSecondary}
      >
        PDF 다운로드
      </button>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/50 p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) closePreview();
          }}
        >
          <div
            className="relative mx-auto flex h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200/60"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={closePreview} disabled={loading} />
            <div className="border-b border-slate-100 px-4 py-3 pr-12">
              <h2 className="text-sm font-semibold text-slate-900">
                PDF 미리보기 {quoteNumber ? `— ${quoteNumber}` : ''}
              </h2>
            </div>
            <div className="relative min-h-0 flex-1 bg-slate-100">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                  PDF 생성 중…
                </div>
              )}
              {previewUrl && !loading && (
                <iframe
                  title="견적서 PDF 미리보기"
                  src={previewUrl}
                  className="h-full w-full border-0 bg-white"
                />
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                disabled={loading}
                onClick={closePreview}
                className={qUi.btnSecondary}
              >
                닫기
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleDownload()}
                className={qUi.btnPrimary}
              >
                다운로드
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !previewOpen && <span className="text-fluid-2xs text-rose-600">{error}</span>}
    </>
  );
}
