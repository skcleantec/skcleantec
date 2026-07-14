import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchReviewPaybackPublicMeta,
  submitReviewPayback,
  uploadReviewPaybackImage,
  type ReviewPaybackImageItem,
} from '../../api/reviewPayback';
import { ImageThumbLightbox } from '../../components/ui/ImageThumbLightbox';
import { prepareImageFileForUpload } from '../../utils/imageResizeForUpload';
import { resolveInitialTenantSlug } from '../../utils/tenantHostResolve';
import { resolvePublicBrandSlug } from '../../utils/publicTenantQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useParams } from 'react-router-dom';
import {
  KOREAN_BANK_OPTIONS,
  KOREAN_BANK_OTHER,
  resolveBankNameFromSelect,
} from '../../utils/koreanBankOptions';

const DEFAULT_BRAND = '리뷰 페이백 신청';

const STEPS = [
  { title: '리뷰 캡처', desc: '작성한 리뷰 화면을 촬영·업로드' },
  { title: '입금 계좌', desc: '페이백 받을 계좌 정보 입력' },
  { title: '신청 완료', desc: '영업일 기준 5일 이내 입금' },
] as const;

function ReviewPaybackCompleteModal({
  customerName,
  onConfirm,
}: {
  customerName: string;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-payback-complete-title"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-[popIn_180ms_cubic-bezier(0.2,0.7,0.2,1.2)]"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
            <svg
              className="h-7 w-7 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 id="review-payback-complete-title" className="mt-4 text-base font-semibold tracking-tight text-slate-900">
            페이백 신청이 접수되었습니다
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
            {customerName ? (
              <>
                <span className="font-medium text-slate-900">{customerName}</span>님, 신청이 정상적으로 저장되었습니다.
              </>
            ) : (
              '신청이 정상적으로 저장되었습니다.'
            )}
          </p>
          <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-3 text-fluid-sm leading-relaxed text-emerald-950">
            리뷰 확인 후 <span className="font-semibold">영업일 기준 5일 이내</span>에 등록하신 계좌로 입금됩니다.
          </p>
          <p className="mt-3 text-fluid-xs text-slate-500 leading-relaxed">
            전화·카톡으로 별도 연락하실 필요 없습니다.
          </p>
        </div>
        <div className="flex justify-center border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] touch-manipulation"
            autoFocus
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PageShell({
  brandName,
  customerName,
  children,
}: {
  brandName: string;
  customerName?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#f1f5f9';
    document.documentElement.style.backgroundColor = '#f1f5f9';
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-1 flex-col w-full bg-slate-100">
      <header className="bg-slate-900 text-white shrink-0">
        <div className="max-w-lg mx-auto px-4 py-4 sm:py-5">
          <p className="text-fluid-xs text-slate-400 uppercase tracking-wider">Review Payback</p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{brandName}</h1>
          <p className="text-fluid-sm text-slate-300 mt-1 leading-snug">
            {customerName ? (
              <>
                <span className="text-white font-medium">{customerName}</span>님, 아래 양식으로 신청해 주세요.
              </>
            ) : (
              '리뷰 작성 후 캡처·계좌를 등록하면 페이백 신청이 완료됩니다.'
            )}
          </p>
        </div>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 sm:py-8 pb-10 min-w-0 bg-slate-100">
        {children}
      </main>
    </div>
  );
}

export function ReviewPaybackPage() {
  const { token = '' } = useParams<{ token: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState(DEFAULT_BRAND);
  const [customerName, setCustomerName] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [bankSelect, setBankSelect] = useState('');
  const [bankOther, setBankOther] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [images, setImages] = useState<ReviewPaybackImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(brandName);

  const resolvedBankName = useMemo(
    () => resolveBankNameFromSelect(bankSelect, bankOther),
    [bankSelect, bankOther],
  );

  useEffect(() => {
    const slug = resolveInitialTenantSlug();
    if (!slug) return;
    const brand = resolvePublicBrandSlug();
    const qs = new URLSearchParams({ slug });
    if (brand) qs.set('brand', brand);
    void fetch(`/api/tenant/public-info?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { displayName?: string } | null) => {
        if (body?.displayName?.trim()) setBrandName(`${body.displayName.trim()} 리뷰 페이백`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('유효하지 않은 링크입니다.');
      return;
    }
    setLoading(true);
    void fetchReviewPaybackPublicMeta(token)
      .then((meta) => {
        setCustomerName(meta.customerName);
        setAlreadySubmitted(meta.alreadySubmitted);
        setSubmitted(meta.alreadySubmitted);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '정보를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const canSubmit =
    !submitted &&
    !alreadySubmitted &&
    resolvedBankName.length > 0 &&
    accountNumber.trim().length > 0 &&
    images.length > 0 &&
    !uploading &&
    !submitting;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !token) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded: ReviewPaybackImageItem[] = [];
      for (const file of Array.from(files)) {
        const prepared = await prepareImageFileForUpload(file);
        const { url, publicId } = await uploadReviewPaybackImage(token, prepared);
        uploaded.push({ url, publicId: publicId ?? null });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !token || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReviewPayback(token, {
        bankName: resolvedBankName,
        accountNumber: accountNumber.trim(),
        reviewImages: images,
      });
      setSubmitted(true);
      setAlreadySubmitted(true);
      setCompleteModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell brandName={brandName}>
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 mb-3" />
          <p className="text-fluid-sm">정보를 불러오는 중…</p>
        </div>
      </PageShell>
    );
  }

  if (submitted || alreadySubmitted) {
    return (
      <PageShell brandName={brandName} customerName={customerName}>
        {completeModalOpen ? (
          <ReviewPaybackCompleteModal
            customerName={customerName}
            onConfirm={() => setCompleteModalOpen(false)}
          />
        ) : null}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-300/40 border border-slate-100 px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">페이백 신청이 접수되었습니다</h2>
          <p className="text-fluid-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            {customerName ? `${customerName}님, ` : ''}
            리뷰 확인 후 <span className="font-medium text-slate-800">영업일 기준 5일 이내</span>에 입금됩니다.
            <br />
            <span className="text-slate-500">전화·카톡으로 별도 연락하실 필요 없습니다.</span>
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-fluid-xs text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            접수 완료 · 입금 대기
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell brandName={brandName} customerName={customerName}>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {STEPS.slice(0, 2).map((step, idx) => (
          <div
            key={step.title}
            className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-3 text-center shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Step {idx + 1}</p>
            <p className="mt-0.5 text-fluid-xs font-semibold text-slate-800">{step.title}</p>
          </div>
        ))}
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Step 3</p>
          <p className="mt-0.5 text-fluid-xs font-medium text-slate-500">{STEPS[2].title}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-300/35 border border-slate-100 overflow-hidden">
        <div className="px-5 sm:px-6 pt-6 pb-4 border-b border-slate-100 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">페이백 신청서</h2>
          <p className="text-fluid-sm text-slate-500 mt-1">리뷰 작성 후, 이 페이지에서만 신청해 주세요.</p>
        </div>

        <div className="px-5 sm:px-6 py-4 border-b border-amber-100/80 bg-amber-50/60">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <div className="min-w-0 text-fluid-sm text-amber-950 leading-relaxed">
              <p className="font-semibold text-amber-900">반드시 이 페이지에서 신청해 주세요</p>
              <p className="mt-1 text-amber-900/85">
                리뷰 캡처와 계좌를 등록하시면 됩니다. 전화·카톡으로 보내주시면 확인이 지연될 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-6">
          <section className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">1. 리뷰 캡처</p>
                <p className="text-fluid-xs text-slate-500 mt-0.5">여러 장 선택 가능 · 고화질 사진은 자동 압축됩니다</p>
              </div>
              {images.length > 0 ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {images.length}장
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 mb-3 min-h-[2.75rem]">
              {images.map((img, idx) => {
                const slides = images.map((item, j) => ({ src: item.url, alt: `리뷰 캡처 ${j + 1}` }));
                return (
                  <div key={`${img.url}-${idx}`} className="relative inline-block">
                    <ImageThumbLightbox
                      src={img.url}
                      alt={`리뷰 캡처 ${idx + 1}`}
                      thumbClassName="h-full w-full object-cover"
                      buttonClassName="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 touch-manipulation"
                      gallerySlides={images.length > 1 ? slides : undefined}
                      galleryIndex={idx}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-xs leading-none shadow touch-manipulation"
                      aria-label="이미지 삭제"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-fluid-sm font-medium text-slate-700 shadow-sm touch-manipulation ${
                uploading ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {uploading ? '업로드 중…' : images.length > 0 ? '캡처 추가' : '리뷰 캡처 선택'}
            </button>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-3">2. 입금 계좌</p>
            </div>

            <div>
              <label htmlFor="bank-select" className="block text-sm font-medium text-slate-700 mb-1.5">
                은행
              </label>
              <select
                id="bank-select"
                value={bankSelect}
                onChange={(e) => setBankSelect(e.target.value)}
                className="w-full min-h-[44px] appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              >
                <option value="">은행을 선택해 주세요</option>
                {KOREAN_BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {bankSelect === KOREAN_BANK_OTHER ? (
              <div>
                <label htmlFor="bank-other" className="block text-sm font-medium text-slate-700 mb-1.5">
                  은행명
                </label>
                <input
                  id="bank-other"
                  type="text"
                  value={bankOther}
                  onChange={(e) => setBankOther(e.target.value)}
                  placeholder="예: SC제일은행"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="account-number" className="block text-sm font-medium text-slate-700 mb-1.5">
                계좌번호
              </label>
              <input
                id="account-number"
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="- 없이 숫자만 입력"
                autoComplete="off"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm tabular-nums focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
              <p className="mt-1.5 text-fluid-xs text-slate-500">본인 명의 계좌로만 입금됩니다.</p>
            </div>
          </section>

          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-fluid-sm text-red-800 whitespace-pre-wrap">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full min-h-[48px] rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white shadow-md shadow-slate-900/15 hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-45 touch-manipulation"
          >
            {submitting ? '제출 중…' : uploading ? '캡처 업로드 중…' : '리뷰 페이백 신청'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-fluid-xs text-slate-500 px-2 leading-relaxed">
        입력하신 계좌·캡처 정보는 페이백 처리 목적으로만 사용됩니다.
      </p>
    </PageShell>
  );
}
