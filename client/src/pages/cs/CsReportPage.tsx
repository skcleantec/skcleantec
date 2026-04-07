import { useState } from 'react';
import { submitCsReport, uploadCsImage } from '../../api/cs';
import { ImageThumbLightbox } from '../../components/ui/ImageThumbLightbox';
import { prepareImageFileForUpload } from '../../utils/imageResizeForUpload';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function CsReportPage() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceRating, setServiceRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  /** 선택한 파일 처리 중 (모두 끝나야 접수 가능) */
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formTextOk =
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    content.trim().length > 0 &&
    serviceRating != null &&
    serviceRating >= 1 &&
    serviceRating <= 5;
  const canSubmit = formTextOk && !uploading && !submitting;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    setError(null);
    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i++) {
        const raw = list[i];
        try {
          if (raw.type === 'image/heic' || raw.name.toLowerCase().endsWith('.heic')) {
            setError(
              (prev) =>
                prev ??
                'HEIC 형식은 이 브라우저에서 자동 변환이 어렵습니다. 사진 앱에서 JPG로 저장한 뒤 올려 주세요.'
            );
          } else {
            const file = await prepareImageFileForUpload(raw);
            const { url } = await uploadCsImage(file);
            setImageUrls((prev) => [...prev, url]);
          }
        } catch (inner) {
          setError(
            (prev) =>
              prev ??
              (inner instanceof Error ? inner.message : `${raw.name}: 업로드에 실패했습니다.`)
          );
        } finally {
          setUploadProgress({ done: i + 1, total: list.length });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!formTextOk) {
        if (serviceRating == null) {
          setError('서비스 품질을 별점으로 선택해 주세요.');
        } else {
          setError('성함, 연락처, 내용을 입력해 주세요.');
        }
      }
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitCsReport({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        content: content.trim(),
        serviceRating: serviceRating!,
        imageUrls,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200/80 flex flex-col">
        <header className="bg-slate-900 text-white shrink-0">
          <div className="max-w-lg mx-auto px-4 py-4 sm:py-5">
            <p className="text-fluid-xs text-slate-400 uppercase tracking-wider">고객 지원</p>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">SK클린텍</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl shadow-slate-300/40 border border-slate-100 px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">접수가 완료되었습니다</h2>
            <p className="text-fluid-sm text-slate-600 leading-relaxed">
              빠르게 확인 후 연락드리겠습니다. 감사합니다.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200/80 flex flex-col">
      <header className="bg-slate-900 text-white shrink-0">
        <div className="max-w-lg mx-auto px-4 py-4 sm:py-5">
          <p className="text-fluid-xs text-slate-400 uppercase tracking-wider">고객 지원</p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">SK클린텍</h1>
          <p className="text-fluid-sm text-slate-300 mt-1 leading-snug">
            칭찬하기 및 불편사항 접수 · 사진 첨부 가능
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 sm:py-8 pb-10 min-w-0">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-300/35 border border-slate-100 overflow-hidden">
          <div className="px-5 sm:px-6 pt-6 pb-2 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">C/S 접수</h2>
            <p className="text-fluid-sm text-slate-500 mt-1">
              서비스에 대한 칭찬·불편 사항을 남겨 주세요. 모바일 고화질 사진은 자동으로 압축되어 올라갑니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 text-fluid-sm text-slate-700 leading-relaxed">
              <span className="font-medium text-slate-800">안내</span>
              {': '}
              접수 시 등록하셨던 <strong className="font-semibold text-slate-900">성함</strong>과{' '}
              <strong className="font-semibold text-slate-900">연락처</strong>를 그대로 적어 주시면 기존 건과
              빠르게 연결되어 처리가 정확해집니다.
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">성함</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full min-h-[44px] border border-slate-200 rounded-xl px-3 py-2.5 text-fluid-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-300"
                placeholder="홍길동"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">연락처</label>
              <input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full min-h-[44px] border border-slate-200 rounded-xl px-3 py-2.5 text-fluid-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-300"
                placeholder="010-1234-5678"
                autoComplete="tel"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">
                서비스 품질 평가 <span className="text-red-600 font-semibold">*</span>
              </span>
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="서비스 품질 1점에서 5점까지 선택"
              >
                {STAR_VALUES.map((n) => {
                  const filled = serviceRating != null && n <= serviceRating;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setServiceRating(n)}
                      className={`min-h-[44px] min-w-[44px] rounded-xl text-2xl leading-none touch-manipulation transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 ${
                        filled ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400'
                      }`}
                      aria-label={`${n}점`}
                    >
                      ★
                    </button>
                  );
                })}
                {serviceRating != null && (
                  <span className="text-fluid-sm text-slate-600 tabular-nums ml-1">{serviceRating}점</span>
                )}
              </div>
              <p className="text-fluid-xs text-slate-500 mt-2">전반적인 서비스 만족도를 별로 표시해 주세요.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-fluid-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-300"
                placeholder="칭찬·불편 사항을 구체적으로 적어 주세요."
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">사진 첨부 (선택)</label>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[2.75rem]">
                {imageUrls.map((url, i) => {
                  const slides = imageUrls.map((u, j) => ({ src: u, alt: `첨부 ${j + 1}` }));
                  return (
                    <div key={i} className="relative inline-block">
                      <ImageThumbLightbox
                        src={url}
                        alt={`첨부 ${i + 1}`}
                        thumbClassName="h-full w-full object-cover"
                        buttonClassName="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25 touch-manipulation"
                        gallerySlides={imageUrls.length > 1 ? slides : undefined}
                        galleryIndex={i}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-xs leading-none touch-manipulation shadow"
                        aria-label="첨부 삭제"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <label className="inline-block">
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" disabled={uploading} />
                <span
                  className={`inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-fluid-sm font-medium rounded-xl border border-slate-200 bg-white cursor-pointer touch-manipulation ${
                    uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 active:bg-slate-100'
                  }`}
                >
                  {uploading ? '사진 업로드 중…' : '사진 추가'}
                </span>
              </label>
              {uploadProgress && (
                <p className="text-fluid-xs text-slate-600 mt-2 tabular-nums">
                  업로드 {uploadProgress.done}/{uploadProgress.total}
                </p>
              )}
              {!uploading && imageUrls.length === 0 && (
                <p className="text-fluid-xs text-slate-500 mt-2">사진 없이도 접수할 수 있습니다.</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-fluid-sm text-red-800 whitespace-pre-wrap">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              title={uploading ? '사진 업로드가 끝난 뒤 접수할 수 있습니다.' : undefined}
              className="w-full min-h-[48px] py-3 rounded-xl text-fluid-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-45 disabled:cursor-not-allowed touch-manipulation shadow-md shadow-slate-900/15"
            >
              {submitting ? '접수 중…' : uploading ? '사진 업로드 중…' : '접수하기'}
            </button>
          </form>
        </div>

        <p className="text-center text-fluid-xs text-slate-500 mt-6 px-2 leading-relaxed">
          입력하신 정보는 접수·처리 목적으로만 사용됩니다.
        </p>
      </main>
    </div>
  );
}
