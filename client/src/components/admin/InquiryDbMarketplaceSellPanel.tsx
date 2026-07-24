import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  completeRecallDbMarketplaceListing,
  cartRecallDbMarketplaceListing,
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
import { DbMarketplaceCartAddButton } from '../db-marketplace/marketplaceUiParts';
import { computeMarketplaceDisplayAmount, parseListingFeeInput } from '@shared/dbMarketplaceAmount';
import { DbMarketplaceAudiencePickerModal } from './DbMarketplaceAudiencePickerModal';
import { ConfirmPasswordModal } from './ConfirmPasswordModal';
import { HelpTooltip } from '../ui/HelpTooltip';
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
  /** 장바구니·게시·확정 등 listing 변경 후 스케줄 목록·상세 갱신 */
  onListingChange?: () => void | Promise<void>;
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
  onListingChange,
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
  const [recallModalOpen, setRecallModalOpen] = useState(false);
  const [cartRecallModalOpen, setCartRecallModalOpen] = useState(false);

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
          setListingFeeInput(
            listingRow.listingFee > 0 ? listingRow.listingFee.toLocaleString('ko-KR') : '',
          );
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

  const notifyListingChange = async () => {
    try {
      await onListingChange?.();
    } catch {
      /* 목록 갱신 실패는 패널 저장 성공과 분리 */
    }
  };

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
      await notifyListingChange();
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
      await notifyListingChange();
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
    if (!window.confirm('구매자에게 DB 인계를 확정할까요?')) return;
    setBusy(true);
    try {
      const result = await confirmDbMarketplaceSeller(token, listing.id);
      setListing(result.listing);
      await notifyListingChange();
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

  const completeRecall = async (password: string) => {
    if (!token || !listing) return;
    const result = await completeRecallDbMarketplaceListing(token, listing.id, password);
    setListing(null);
    setRecallModalOpen(false);
    await notifyListingChange();
    alert(
      `완전 회수했습니다.\n정보공유 수수료 ${result.refundListingFee.toLocaleString('ko-KR')}원이 정산 미수에 환불 반영됩니다.\n일반 접수로 복귀했습니다.`,
    );
  };

  const cartRecall = async (password: string) => {
    if (!token || !listing) return;
    await cartRecallDbMarketplaceListing(token, listing.id, password);
    const refreshed = await getDbListingByInquiry(token, inquiryId);
    setListing(refreshed);
    setCartRecallModalOpen(false);
    await notifyListingChange();
    alert('장바구니 회수했습니다. 다시 게시할 수 있습니다.');
  };

  const canEdit = !disabled && listing?.status !== 'CONFIRMED' && listing?.status !== 'PENDING_SELLER';

  const panelMetaText = 'text-[10px] leading-snug text-gray-600 sm:text-[11px]';
  const panelBtn =
    'rounded-md border px-2 py-1 text-[10px] font-medium disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-[11px]';

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-2 space-y-1.5 sm:rounded-xl sm:p-3 sm:space-y-2">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-semibold leading-tight text-violet-900 sm:text-xs">
          <span className="sm:hidden">DB 마켓 판매</span>
          <span className="hidden sm:inline">정보공유(DB 마켓) 판매</span>
        </p>
        <HelpTooltip
          text={
            '파트너·타업체가 선택해 가져갈 수 있도록 게시합니다. 구매자에게는 표시금액(잔금−수수료)만 보입니다.\n' +
            '파트너 직접 연계와 별도입니다. 수수료는 인계 확정(구매자·판매자 모두 확정) 시점에 DB가 넘어가며, 그때 파트너·타업체 정산에 반영됩니다.'
          }
        />
      </div>

      {loading ? <p className={`${panelMetaText} text-gray-500`}>불러오는 중…</p> : null}
      {error ? <p className={`${panelMetaText} text-red-600`}>{error}</p> : null}

      {listing ? (
        <p className={`${panelMetaText} font-medium text-violet-800`}>
          <span className="sm:hidden">
            {STATUS_LABEL[listing.status] ?? listing.status}
            {listing.displayAmount != null
              ? ` · ${listing.displayAmount.toLocaleString('ko-KR')}원`
              : ''}
          </span>
          <span className="hidden sm:inline">
            상태: {STATUS_LABEL[listing.status] ?? listing.status}
            {listing.displayAmount != null
              ? ` · 표시금액 ${listing.displayAmount.toLocaleString('ko-KR')}원`
              : ''}
          </span>
        </p>
      ) : null}

      {listing?.platformSuspendedAt ? (
        <p className={`${panelMetaText} font-medium text-red-700`}>
          플랫폼에 의해 일시 중지되었습니다. 구매 신청이 차단됩니다.
        </p>
      ) : null}

      {listing?.status === 'OPEN' && listing.expiresAt ? (
        <p className={panelMetaText}>
          <span className="sm:hidden">만료 {new Date(listing.expiresAt).toLocaleDateString('ko-KR')}</span>
          <span className="hidden sm:inline">
            게시 만료: {new Date(listing.expiresAt).toLocaleDateString('ko-KR')}
          </span>
        </p>
      ) : null}

      {listing?.status === 'EXPIRED' ? (
        <p className={panelMetaText}>게시 기간이 만료되었습니다. 다시 게시할 수 있습니다.</p>
      ) : null}

      {listing?.buyerName ? (
        <p className={`${panelMetaText} text-amber-800`}>
          구매: {listing.buyerName}
          {listing.buyerConfirmedAt ? (
            <span className="sm:hidden"> (확정)</span>
          ) : null}
          {listing.buyerConfirmedAt ? (
            <span className="hidden sm:inline"> (구매자 확정 완료)</span>
          ) : null}
        </p>
      ) : null}

      {listing ? (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 sm:gap-x-3 sm:gap-y-1">
          <Link
            to={`/admin/db-marketplace?tab=${listing.status === 'DRAFT' ? 'cart' : 'my_sales'}&openListing=${encodeURIComponent(listing.id)}`}
            className="inline-block text-[10px] font-medium text-violet-800 underline hover:text-violet-950 sm:text-[11px]"
          >
            <span className="sm:hidden">목록</span>
            <span className="hidden sm:inline">정보공유 목록에서 보기</span>
          </Link>
          <Link
            to={`/admin/schedule?openInquiry=${encodeURIComponent(inquiryId)}`}
            className="inline-block text-[10px] font-medium text-sky-800 underline hover:text-sky-950 sm:text-[11px]"
          >
            <span className="sm:hidden">스케줄</span>
            <span className="hidden sm:inline">스케줄에서 접수 보기</span>
          </Link>
        </div>
      ) : null}

      {listing?.status === 'PENDING_SELLER' ? (
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void sellerConfirm()}
            className={`${panelBtn} flex-1 min-w-[6.5rem] border-transparent bg-slate-900 text-white hover:bg-slate-800`}
          >
            인계 확정
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sellerDecline()}
            className={`${panelBtn} flex-1 min-w-[6.5rem] border-amber-300 bg-white text-amber-900 hover:bg-amber-50`}
          >
            <span className="sm:hidden">거절</span>
            <span className="hidden sm:inline">구매 신청 거절</span>
          </button>
        </div>
      ) : null}

      {listing?.rootTenantName && listing.hopIndex && listing.hopIndex > 0 ? (
        <p className={`${panelMetaText} text-violet-900`}>
          최초 업체: {listing.rootTenantName} · 재판매 hop {listing.hopIndex}
        </p>
      ) : null}

      {listing?.status === 'CONFIRMED' ? (
        <div className="rounded-md border border-rose-200 bg-rose-50/80 p-2 space-y-1.5 sm:rounded-lg sm:p-2.5 sm:space-y-2">
          <p className={`${panelMetaText} text-rose-950`}>
            인계가 완료된 DB입니다. <strong>완전 회수</strong>는 일반 접수(TO 포함)로,
            <strong> 장바구니 회수</strong>는 정보공유 장바구니로 돌아갑니다(TO 제외). 하위 재판매가
            있으면 함께 되돌립니다.
          </p>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRecallModalOpen(true)}
              className={`${panelBtn} w-full border-rose-400 bg-white text-rose-950 hover:bg-rose-50`}
            >
              완전 회수
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCartRecallModalOpen(true)}
              className={`${panelBtn} w-full border-violet-400 bg-white text-violet-950 hover:bg-violet-50`}
            >
              장바구니 회수
            </button>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <>
          <div className="flex items-end gap-2 sm:block">
            <label className="mb-0 shrink-0 text-[10px] text-gray-600 sm:mb-1 sm:block sm:text-[11px]">
              <span className="sm:hidden">수수료</span>
              <span className="hidden sm:inline">수수료 (원)</span>{' '}
              <span className="text-red-600">*</span>
            </label>
            <input
              value={listingFeeInput}
              onChange={(e) => setListingFeeInput(e.target.value)}
              className={`min-w-0 flex-1 rounded-md border px-2 py-1 text-[11px] sm:w-full sm:rounded-lg sm:py-1.5 sm:text-fluid-xs ${
                listingFeeInput.trim() && !listingFeeValid
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-gray-300'
              }`}
              placeholder="금액"
              inputMode="numeric"
              required
              aria-required
            />
          </div>
          {!listingFeeValid && listingFeeInput.trim() ? (
            <p className={`${panelMetaText} text-red-600`}>올바른 수수료 금액을 입력해 주세요.</p>
          ) : null}
          <p className={`${panelMetaText} text-gray-500`}>
            <span className="sm:hidden">표시 </span>
            <span className="hidden sm:inline">구매자 표시금액(잔금−수수료): </span>
            {previewAmount != null ? `${previewAmount.toLocaleString('ko-KR')}원` : '잔금 확인 필요'}
          </p>

          <div className="flex flex-wrap gap-1 sm:gap-2">
            <DbMarketplaceCartAddButton
              disabled={busy || !listingFeeValid}
              onClick={() => void saveDraft()}
              title={!listingFeeValid ? '수수료를 입력해 주세요.' : undefined}
            />
            {listing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAudienceModal(true)}
                  className={`${panelBtn} border-violet-300 bg-white text-violet-900 hover:bg-violet-50`}
                >
                  <span className="sm:hidden">노출</span>
                  <span className="hidden sm:inline">노출 대상</span>
                </button>
                {(listing.status === 'DRAFT' ||
                  listing.status === 'WITHDRAWN' ||
                  listing.status === 'EXPIRED') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void publish()}
                    className={`${panelBtn} border-transparent bg-slate-900 text-white hover:bg-slate-800`}
                  >
                    <span className="sm:hidden">게시</span>
                    <span className="hidden sm:inline">
                      {listing.status === 'EXPIRED' ? '다시 게시' : '정보공유 게시'}
                    </span>
                  </button>
                )}
                {listing.status === 'OPEN' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void withdraw()}
                    className={`${panelBtn} border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
                  >
                    <span className="sm:hidden">철회</span>
                    <span className="hidden sm:inline">게시 철회</span>
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

      {recallModalOpen
        ? createPortal(
            <ConfirmPasswordModal
              open={recallModalOpen}
              title="완전 회수 확인"
              zIndexClassName="z-[560]"
              confirmLabel="완전 회수"
              description={
                <>
                  구매자 DB가 종료되고, 정보공유{' '}
                  <strong>수수료 {listing?.listingFee?.toLocaleString('ko-KR') ?? '?'}원</strong>만
                  정산 미수에 환불 반영됩니다. 잔금(표시금액) 전체가 회수되는 것은 아닙니다. 되돌릴
                  수 없습니다.
                  {listing?.buyerName ? (
                    <>
                      <br />
                      구매: {listing.buyerName}
                    </>
                  ) : null}
                </>
              }
              onClose={() => setRecallModalOpen(false)}
              onConfirm={completeRecall}
            />,
            document.body,
          )
        : null}

      {cartRecallModalOpen
        ? createPortal(
            <ConfirmPasswordModal
              open={cartRecallModalOpen}
              title="장바구니 회수 확인"
              zIndexClassName="z-[560]"
              confirmLabel="장바구니 회수"
              description={
                <>
                  구매자 연계를 해제하고 이 DB를 정보공유 <strong>장바구니</strong>로 되돌립니다. TO는
                  소모하지 않습니다. 하위 재판매가 있으면 함께 되돌립니다.
                </>
              }
              onClose={() => setCartRecallModalOpen(false)}
              onConfirm={cartRecall}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
