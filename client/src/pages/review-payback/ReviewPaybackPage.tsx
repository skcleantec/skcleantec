import { useEffect, useState } from 'react';
import {
  fetchReviewPaybackPublicMeta,
  submitReviewPayback,
  uploadReviewPaybackImage,
} from '../../api/reviewPayback';
import { ImageThumbLightbox } from '../../components/ui/ImageThumbLightbox';
import { prepareImageFileForUpload } from '../../utils/imageResizeForUpload';
import { resolveInitialTenantSlug } from '../../utils/tenantHostResolve';
import { resolvePublicBrandSlug } from '../../utils/publicTenantQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useParams } from 'react-router-dom';

const DEFAULT_BRAND = '리뷰 페이백 신청';

const BANK_OPTIONS = [
  '국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  '농협',
  '기업은행',
  '카카오뱅크',
  '토스뱅크',
  '새마을금고',
  '신협',
  '기타',
] as const;

export function ReviewPaybackPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [brandName, setBrandName] = useState(DEFAULT_BRAND);
  const [customerName, setCustomerName] = useState('');
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePublicId, setImagePublicId] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(brandName);

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
    bankName.trim().length > 0 &&
    accountNumber.trim().length > 0 &&
    imageUrl.length > 0 &&
    !uploading &&
    !submitting;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setError(null);
    setUploading(true);
    try {
      const prepared = await prepareImageFileForUpload(file);
      const { url, publicId } = await uploadReviewPaybackImage(token, prepared);
      setImageUrl(url);
      setImagePublicId(publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReviewPayback(token, {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        reviewImageUrl: imageUrl,
        reviewImagePublicId: imagePublicId,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-gray-500 text-fluid-sm">불러오는 중…</div>
    );
  }

  if (submitted || alreadySubmitted) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-fluid-lg font-semibold text-gray-900">{brandName}</h1>
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-fluid-sm text-green-900">
          {customerName ? `${customerName}님, ` : ''}페이백 신청이 접수되었습니다.
          <br />
          확인 후 입금 처리됩니다. 전화로 별도 연락하실 필요 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4 sm:p-6">
      <h1 className="text-fluid-lg font-semibold text-gray-900">{brandName}</h1>
      {customerName ? (
        <p className="mt-1 text-fluid-sm text-gray-600">{customerName}님</p>
      ) : null}

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-fluid-xs leading-relaxed text-amber-950">
        <strong>반드시 이 페이지에서 신청해 주세요.</strong>
        <br />
        리뷰 작성 후 캡처·계좌를 등록해 주시면 됩니다. 전화·카톡으로 보내주시면 확인이 지연될 수 있습니다.
      </div>

      {error ? (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1 block text-fluid-sm font-medium text-gray-700">리뷰 캡처</label>
          <input type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} className="text-fluid-xs" />
          {uploading ? <p className="mt-1 text-fluid-xs text-gray-500">업로드 중…</p> : null}
          {imageUrl ? (
            <div className="mt-2">
              <ImageThumbLightbox src={imageUrl} alt="리뷰 캡처" thumbClassName="h-24 w-auto object-contain" />
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-fluid-sm font-medium text-gray-700">은행</label>
          <select
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm"
          >
            <option value="">선택</option>
            {BANK_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-fluid-sm font-medium text-gray-700">계좌번호</label>
          <input
            type="text"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="- 없이 입력"
            className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm tabular-nums"
          />
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="w-full rounded-lg bg-gray-900 px-4 py-3 text-fluid-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '제출 중…' : '리뷰 페이백 신청'}
        </button>
      </div>
    </div>
  );
}
