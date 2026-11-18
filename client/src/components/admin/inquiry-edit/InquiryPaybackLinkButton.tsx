import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../ui/Button';
import { getInquiry } from '../../../api/inquiries';
import { getReviewPaybackPublicUrl } from '../../../utils/reviewPaybackCustomerCopy';

/** 접수 수정 상단 「페이백」 — 고객이 전화로 페이백 링크를 달라고 할 때 바로 열고 복사 */
export function InquiryPaybackLinkButton({
  inquiryId,
  token,
  tenantSlug,
  brandSlug,
  customerName,
  initialPaybackToken,
}: {
  inquiryId: string;
  token: string;
  tenantSlug?: string | null;
  brandSlug?: string | null;
  customerName?: string | null;
  initialPaybackToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [paybackToken, setPaybackToken] = useState<string | null>(initialPaybackToken?.trim() || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || paybackToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getInquiry(token, inquiryId)
      .then((data) => {
        if (cancelled) return;
        const t = (data as { orderForm?: { reviewPaybackToken?: string | null } | null }).orderForm
          ?.reviewPaybackToken;
        if (t?.trim()) setPaybackToken(t.trim());
        else setError('아직 페이백 링크가 없어요. 접수 목록을 한 번 새로고침한 뒤 다시 눌러 주세요.');
      })
      .catch(() => {
        if (!cancelled) setError('페이백 링크를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, paybackToken, token, inquiryId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const url = paybackToken ? getReviewPaybackPublicUrl(paybackToken, undefined, tenantSlug, brandSlug) : '';

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('아래 링크를 복사해 주세요.', url);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        title="고객에게 보낼 리뷰 페이백 신청 링크를 열고 복사합니다."
      >
        페이백
      </Button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-900/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inquiry-payback-link-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
                <div className="text-center">
                  <h2 id="inquiry-payback-link-title" className="text-fluid-sm font-semibold text-slate-900">
                    페이백 신청 링크
                  </h2>
                  <p className="mt-0.5 text-fluid-xs text-slate-500">
                    {customerName?.trim() ? `${customerName.trim()} 고객님 · ` : ''}리뷰 캡처·계좌를 등록하는 화면
                  </p>
                </div>
                <div className="mt-4">
                  {loading ? (
                    <p className="py-6 text-center text-fluid-xs text-slate-500">불러오는 중…</p>
                  ) : error ? (
                    <p className="rounded-xl bg-amber-50 px-3 py-3 text-center text-fluid-xs text-amber-900">{error}</p>
                  ) : url ? (
                    <>
                      <p className="break-all rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200/70">
                        {url}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-fluid-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                        >
                          열어보기
                        </a>
                        <button
                          type="button"
                          onClick={() => void copy()}
                          className={`inline-flex h-9 items-center justify-center rounded-xl text-fluid-xs font-semibold shadow-sm transition-colors ${
                            copied ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {copied ? '복사됨' : '링크 복사'}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-fluid-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
