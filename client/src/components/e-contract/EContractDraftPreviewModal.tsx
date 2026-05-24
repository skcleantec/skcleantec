import { useEffect, useState } from 'react';
import { previewEContractExpandedBody } from '../../api/adminEContract';
import { EContractBodyDisplay } from './EContractBodyDisplay';

type Props = {
  open: boolean;
  onClose: () => void;
  token: string | null;
  bodyMarkdown: string;
};

/** 초안 편집 — 버튼으로만 호출하는 배포·체결 화면 미리보기 */
export function EContractDraftPreviewModal({ open, onClose, token, bodyMarkdown }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) {
      setHtml(null);
      setErr(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setHtml(null);
    void (async () => {
      try {
        const { expanded, appendixHtml } = await previewEContractExpandedBody(token, bodyMarkdown);
        if (!cancelled) {
          setHtml(expanded + (typeof appendixHtml === 'string' ? appendixHtml : ''));
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '미리보기를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, bodyMarkdown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ec-draft-preview-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(94vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-xl sm:rounded-lg">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0 pr-2">
            <h2 id="ec-draft-preview-title" className="text-fluid-md font-semibold text-gray-900">
              배포·체결 화면 미리보기
            </h2>
            <p className="mt-1 text-fluid-2xs text-gray-600">
              작성하신 본문에 발행측(갑) 토큰이 치환된 뒤, 하단에 계약주·계약자 정보 표가 자동으로 붙은 형태입니다.
              배포 후 수신자에게 보이는 문서와 동일합니다(을 항목은 체결 시 입력·치환).
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
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-fluid-sm text-gray-500">미리보기를 준비하는 중…</p>
          ) : err ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</p>
          ) : (
            <div className="rounded border border-gray-200 bg-white p-2">
              <EContractBodyDisplay body={html ?? ''} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
