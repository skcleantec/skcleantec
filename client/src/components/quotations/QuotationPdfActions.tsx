import { useCallback, useEffect, useState } from 'react';
import { downloadQuotationPdf } from '../../api/quotations';
import { ModalCloseButton } from '../admin/ModalCloseButton';

type Props = {
  token: string;
  quotationId: string | null;
  quoteNumber: string | null;
  disabled?: boolean;
};

export function QuotationPdfActions({ token, quotationId, quoteNumber, disabled }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  useEffect(() => () => revokePreview(), [revokePreview]);

  function closePreview() {
    revokePreview();
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
    revokePreview();
    try {
      const blob = await downloadQuotationPdf(token, quotationId, { preview: true });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기에 실패했습니다.');
      alert(e instanceof Error ? e.message : '미리보기에 실패했습니다.');
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
      const url = URL.createObjectURL(blob);
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
        className="px-4 py-2 border rounded text-sm disabled:opacity-50"
      >
        PDF 미리보기
      </button>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => void handleDownload()}
        className="px-4 py-2 border rounded text-sm disabled:opacity-50"
      >
        PDF 다운로드
      </button>

      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-2 sm:p-4">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h2 className="text-sm font-semibold">
                PDF 미리보기 {quoteNumber ? `— ${quoteNumber}` : ''}
              </h2>
              <ModalCloseButton onClick={closePreview} />
            </div>
            <iframe
              title="견적서 PDF 미리보기"
              src={previewUrl}
              className="min-h-0 flex-1 w-full border-0 bg-gray-100"
            />
            <div className="flex justify-end gap-2 border-t px-3 py-2">
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="px-3 py-1.5 text-sm border rounded"
              >
                다운로드
              </button>
              <button
                type="button"
                onClick={closePreview}
                className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !previewOpen && <span className="text-xs text-red-600">{error}</span>}
    </>
  );
}
