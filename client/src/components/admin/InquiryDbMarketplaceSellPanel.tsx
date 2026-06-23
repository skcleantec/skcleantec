import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  confirmDbMarketplaceSeller,
  declineDbMarketplaceSeller,
  getDbListingByInquiry,
  publishDbMarketplaceListing,
  updateDbMarketplaceAudience,
  upsertDbMarketplaceDraft,
  withdrawDbMarketplaceListing,
  type DbMarketplaceAudienceInput,
  type DbMarketplaceSellerListing,
} from '../../api/dbMarketplace';
import { computeMarketplaceDisplayAmount, parseListingFeeInput } from '@shared/dbMarketplaceAmount';
import { DbMarketplaceAudiencePickerModal } from './DbMarketplaceAudiencePickerModal';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';

export type DbMarketplaceExchangePrefill = {
  listingFee?: number;
  partnerTenantId?: string;
};

type Props = {
  inquiryId: string;
  serviceBalanceAmount: number | null | undefined;
  disabled?: boolean;
  /** 파트너 직접 연계 폼 → 정보공유 등록 시 1회 적용 */
  exchangePrefill?: DbMarketplaceExchangePrefill | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '장바구니',
  OPEN: '게시 중',
  PENDING_SELLER: '구매자 확정 · 인계 대기',
  CONFIRMED: '확정 완료',
  WITHDRAWN: '철회됨',
  EXPIRED: '만료',
};

export function InquiryDbMarketplaceSellPanel({
  inquiryId,
  serviceBalanceAmount,
  disabled,
  exchangePrefill,
}: Props) {
  const token = getToken();
  const [listing, setListing] = useState<DbMarketplaceSellerListing | null>(null);
  const [listingFeeInput, setListingFeeInput] = useState('');
  const [visibility, setVisibility] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>([]);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedListingFee = parseListingFeeInput(listingFeeInput);
  const listingFeeValid = parsedListingFee != null;

  const previewAmount = computeMarketplaceDisplayAmount(
    serviceBalanceAmount,
    parsedListingFee ?? 0,
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const listingRow = await getDbListingByInquiry(token, inquiryId);
        setListing(listingRow);
        if (listingRow) {
          setListingFeeInput(listingRow.listingFee.toLocaleString('ko-KR'));
          setVisibility(listingRow.visibility);
          setSelectedPartnerIds(
            listingRow.audiences
              .filter((a) => a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId)
              .map((a) => a.partnerTenantId as string),
          );
          setSelectedExternalIds(
            listingRow.audiences
              .filter((a) => a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId)
              .map((a) => a.externalCompanyId as string),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '불러오기 실패');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [token, inquiryId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const lastPrefillKeyRef = useRef('');
  useEffect(() => {
    if (!exchangePrefill) return;
    const key = JSON.stringify(exchangePrefill);
    if (lastPrefillKeyRef.current === key) return;
    lastPrefillKeyRef.current = key;
    if (exchangePrefill.listingFee != null && Number.isFinite(exchangePrefill.listingFee)) {
      setListingFeeInput(exchangePrefill.listingFee.toLocaleString('ko-KR'));
    }
    if (exchangePrefill.partnerTenantId) {
      setVisibility('SELECTED');
      setSelectedPartnerIds([exchangePrefill.partnerTenantId]);
    }
  }, [exchangePrefill]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    void load({ silent: true });
  }, [load]);

  const { connected: wsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !wsConnected ? 20000 : 0);

  const saveDraft = async () => {
    if (!token) return;
    const fee = parseListingFeeInput(listingFeeInput);
    if (fee == null) {
      alert('수수료를 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const row = await upsertDbMarketplaceDraft(token, inquiryId, fee);
      setListing(row);
      alert('판매 장바구니에 담았습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const saveAudience = async (value: {
    visibility: 'ALL' | 'SELECTED';
    audiences: DbMarketplaceAudienceInput[];
  }) => {
    if (!token || !listing) return;
    setBusy(true);
    try {
      const row = await updateDbMarketplaceAudience(
        token,
        listing.id,
        value.visibility,
        value.audiences,
      );
      setListing(row);
      setVisibility(value.visibility);
      setSelectedPartnerIds(
        value.audiences
          .filter((a) => a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId)
          .map((a) => a.partnerTenantId as string),
      );
      setSelectedExternalIds(
        value.audiences
          .filter((a) => a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId)
          .map((a) => a.externalCompanyId as string),
      );
      setShowAudienceModal(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '노출 대상 저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!token || !listing) return;
    if (!window.confirm('정보공유 마켓에 게시할까요?')) return;
    setBusy(true);
    try {
      const row = await publishDbMarketplaceListing(token, listing.id);
      setListing(row);
    } catch (e) {
      alert(e instanceof Error ? e.message : '게시 실패');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!token || !listing) return;
    if (!window.confirm('게시를 철회할까요?')) return;
    setBusy(true);
    try {
      const row = await withdrawDbMarketplaceListing(token, listing.id);
      setListing(row);
    } catch (e) {
      alert(e instanceof Error ? e.message : '철회 실패');
    } finally {
      setBusy(false);
    }
  };

  const sellerConfirm = async () => {
    if (!token || !listing) return;
    if (!window.confirm('구매자에게 DB 인계를 확정할까요? 확정 후 취소·환불할 수 없습니다.')) return;
    setBusy(true);
    try {
      const result = await confirmDbMarketplaceSeller(token, listing.id);
      setListing(result.listing);
      alert('인계가 완료되었습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '인계 확정 실패');
    } finally {
      setBusy(false);
    }
  };

  const sellerDecline = async () => {
    if (!token || !listing) return;
    if (!window.confirm('구매 신청을 거절하고 다시 게시 상태로 되돌릴까요?')) return;
    setBusy(true);
    try {
      const updated = await declineDbMarketplaceSeller(token, listing.id);
      setListing(updated);
      alert('구매 신청을 거절했습니다. 다시 게시 중입니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : '거절 실패');
    } finally {
      setBusy(false);
    }
  };

  const canEdit = !disabled && listing?.status !== 'CONFIRMED' && listing?.status !== 'PENDING_SELLER';

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-violet-900">정보공유(DB 마켓) 판매</p>
      <p className="text-[11px] text-gray-600 leading-relaxed">
        파트너·타업체가 선택해 가져갈 수 있도록 게시합니다. 구매자에게는 표시금액(잔금−수수료)만 보입니다.{' '}
        <strong>파트너 직접 연계와 별도</strong>입니다.
      </p>

      {loading ? <p className="text-[11px] text-gray-500">불러오는 중…</p> : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

      {listing ? (
        <p className="text-[11px] font-medium text-violet-800">
          상태: {STATUS_LABEL[listing.status] ?? listing.status}
          {listing.displayAmount != null
            ? ` · 표시금액 ${listing.displayAmount.toLocaleString('ko-KR')}원`
            : ''}
        </p>
      ) : null}

      {listing?.platformSuspendedAt ? (
        <p className="text-[11px] font-medium text-red-700">
          플랫폼에 의해 일시 중지되었습니다. 구매 신청이 차단됩니다.
        </p>
      ) : null}

      {listing?.status === 'OPEN' && listing.expiresAt ? (
        <p className="text-[11px] text-gray-600">
          게시 만료: {new Date(listing.expiresAt).toLocaleDateString('ko-KR')}
        </p>
      ) : null}

      {listing?.status === 'EXPIRED' ? (
        <p className="text-[11px] text-gray-600">게시 기간이 만료되었습니다. 다시 게시할 수 있습니다.</p>
      ) : null}

      {listing?.buyerName ? (
        <p className="text-[11px] text-amber-800">
          구매 신청: {listing.buyerName}
          {listing.buyerConfirmedAt ? ' (구매자 확정 완료)' : ''}
        </p>
      ) : null}

      {listing ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link
            to={`/admin/db-marketplace?tab=${listing.status === 'DRAFT' ? 'cart' : 'my_sales'}&openListing=${encodeURIComponent(listing.id)}`}
            className="inline-block text-[11px] font-medium text-violet-800 underline hover:text-violet-950"
          >
            정보공유 목록에서 보기
          </Link>
          <Link
            to={`/admin/schedule?openInquiry=${encodeURIComponent(inquiryId)}`}
            className="inline-block text-[11px] font-medium text-sky-800 underline hover:text-sky-950"
          >
            스케줄에서 접수 보기
          </Link>
        </div>
      ) : null}

      {listing?.status === 'PENDING_SELLER' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void sellerConfirm()}
            className="flex-1 min-w-[8rem] rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            인계 확정
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sellerDecline()}
            className="flex-1 min-w-[8rem] rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            구매 신청 거절
          </button>
        </div>
      ) : null}

      {canEdit ? (
        <>
          <div>
            <label className="block text-gray-600 mb-1 text-[11px]">
              수수료 (원) <span className="text-red-600">*</span>
            </label>
            <input
              value={listingFeeInput}
              onChange={(e) => setListingFeeInput(e.target.value)}
              className={`w-full rounded-lg border px-2 py-1.5 text-fluid-xs ${
                listingFeeInput.trim() && !listingFeeValid
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-gray-300'
              }`}
              placeholder="금액 입력"
              inputMode="numeric"
              required
              aria-required
            />
            {!listingFeeValid && listingFeeInput.trim() ? (
              <p className="mt-1 text-[11px] text-red-600">올바른 수수료 금액을 입력해 주세요.</p>
            ) : null}
            <p className="mt-1 text-[11px] text-gray-500">
              구매자 표시금액(잔금−수수료):{' '}
              {previewAmount != null ? `${previewAmount.toLocaleString('ko-KR')}원` : '잔금 확인 필요'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !listingFeeValid}
              onClick={() => void saveDraft()}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-800 disabled:opacity-50"
              title={!listingFeeValid ? '수수료를 입력해 주세요.' : undefined}
            >
              장바구니 담기
            </button>
            {listing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAudienceModal(true)}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-[11px] font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                >
                  노출 대상
                </button>
                {(listing.status === 'DRAFT' ||
                  listing.status === 'WITHDRAWN' ||
                  listing.status === 'EXPIRED') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void publish()}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {listing.status === 'EXPIRED' ? '다시 게시' : '정보공유 게시'}
                  </button>
                )}
                {listing.status === 'OPEN' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void withdraw()}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    게시 철회
                  </button>
                )}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {showAudienceModal ? (
        <DbMarketplaceAudiencePickerModal
          open={showAudienceModal}
          onClose={() => setShowAudienceModal(false)}
          busy={busy}
          confirmLabel="저장"
          initialVisibility={visibility}
          initialPartnerIds={selectedPartnerIds}
          initialExternalIds={selectedExternalIds}
          onConfirm={saveAudience}
        />
      ) : null}
    </div>
  );
}
