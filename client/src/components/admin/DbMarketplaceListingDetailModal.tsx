import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  confirmDbMarketplaceBuyer,
  confirmDbMarketplaceSeller,
  declineDbMarketplaceSeller,
  getDbMarketplaceListing,
  confirmTeamDbMarketplaceBuyer,
  getTeamDbMarketplaceListing,
  type DbMarketplaceListingDetail,
  type DbMarketplaceMaskedItem,
} from '../../api/dbMarketplace';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { ModalCloseButton } from './ModalCloseButton';

type Props = {
  row: DbMarketplaceMaskedItem;
  onClose: () => void;
  onChanged: () => void;
  apiMode?: 'admin' | 'team';
  token?: string | null;
};

export function DbMarketplaceListingDetailModal({
  row,
  onClose,
  onChanged,
  apiMode = 'admin',
  token: tokenProp,
}: Props) {
  const token = tokenProp ?? getToken();
  const [detail, setDetail] = useState<DbMarketplaceListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) {
        setLoading(true);
      }
      setError(null);
      void (apiMode === 'team'
        ? getTeamDbMarketplaceListing(token, row.id)
        : getDbMarketplaceListing(token, row.id)
      )
        .then(setDetail)
        .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [token, row.id, apiMode],
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    loadDetail({ silent: true });
    onChanged();
  }, [loadDetail, onChanged]);

  const { connected: wsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !wsConnected ? 20000 : 0);

  const runBuyerConfirm = async () => {
    if (!token || !window.confirm('이 DB를 갖고가겠습니까? 판매자 인계 확정 후 전체 정보가 공개됩니다.')) return;
    setBusy(true);
    try {
      await (apiMode === 'team'
        ? confirmTeamDbMarketplaceBuyer(token, row.id)
        : confirmDbMarketplaceBuyer(token, row.id));
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '구매 신청 실패');
    } finally {
      setBusy(false);
    }
  };

  const runSellerConfirm = async () => {
    if (!token || !window.confirm('구매자에게 DB를 인계 확정할까요? 확정 후 취소·환불할 수 없습니다.')) return;
    setBusy(true);
    try {
      const result = await confirmDbMarketplaceSeller(token, row.id);
      if (result.targetInquiryId) {
        alert(`인계가 완료되었습니다.${result.listing.buyerKind === 'PARTNER_TENANT' ? ' 구매자 접수가 생성되었습니다.' : ''}`);
      } else {
        alert('인계가 완료되었습니다.');
      }
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '인계 확정 실패');
    } finally {
      setBusy(false);
    }
  };

  const runSellerDecline = async () => {
    if (!token || !window.confirm('구매 신청을 거절하고 다시 게시 상태로 되돌릴까요?')) return;
    setBusy(true);
    try {
      await declineDbMarketplaceSeller(token, row.id);
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '거절 실패');
    } finally {
      setBusy(false);
    }
  };

  const d = detail ?? (row as DbMarketplaceListingDetail);

  const linkedInquiryPath =
    d.targetInquiryId && d.status === 'CONFIRMED'
      ? apiMode === 'team'
        ? `/team/assignments?openInquiry=${encodeURIComponent(d.targetInquiryId)}`
        : `/admin/inquiries?openInquiry=${encodeURIComponent(d.targetInquiryId)}`
      : null;

  const settlementPath =
    d.status === 'CONFIRMED'
      ? d.buyerKind === 'PARTNER_TENANT'
        ? '/admin/team-leaders/tenant-partner-settlement'
        : d.buyerKind === 'EXTERNAL_COMPANY'
          ? apiMode === 'team'
            ? '/team/settlement'
            : '/admin/team-leaders/external-settlement'
          : null
      : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">정보공유 상세</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="p-4 space-y-3 text-fluid-xs">
          {loading && !detail ? <p className="text-gray-500">불러오는 중…</p> : null}
          {error ? <p className="text-red-600">{error}</p> : null}

          {d.platformSuspended ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              플랫폼에 의해 일시 중지된 건입니다. 구매 신청할 수 없습니다.
            </p>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
            <p>
              <span className="text-gray-500">판매 업체</span> {d.sellerTenantName}
            </p>
            <p>
              <span className="text-gray-500">표시금액</span>{' '}
              {d.displayAmount != null ? `${d.displayAmount.toLocaleString('ko-KR')}원` : '-'}
            </p>
            <p>
              <span className="text-gray-500">고객</span> {d.customerNameMasked} · {d.addressRegion}
            </p>
            {d.buyerName ? (
              <p>
                <span className="text-gray-500">구매 신청</span> {d.buyerName}
              </p>
            ) : null}
          </div>

          {d.inquiryFull ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
              <p className="font-semibold text-emerald-900">확정 완료 — 전체 DB</p>
              <p>고객 {d.inquiryFull.customerName}</p>
              <p>
                {d.inquiryFull.customerPhone}
                {d.inquiryFull.customerPhone2 ? ` / ${d.inquiryFull.customerPhone2}` : ''}
              </p>
              <p>
                {d.inquiryFull.address}
                {d.inquiryFull.addressDetail ? ` ${d.inquiryFull.addressDetail}` : ''}
              </p>
              {d.inquiryFull.serviceBalanceAmount != null ? (
                <p className="tabular-nums">
                  잔금 {d.inquiryFull.serviceBalanceAmount.toLocaleString('ko-KR')}원
                </p>
              ) : null}
              {d.targetInquiryId ? (
                linkedInquiryPath ? (
                  <Link
                    to={linkedInquiryPath}
                    className="inline-block text-[11px] font-medium text-sky-700 hover:text-sky-900 underline"
                    onClick={onClose}
                  >
                    연결 접수 보기
                    {d.inquiryFull?.inquiryNumber ? ` (${d.inquiryFull.inquiryNumber})` : ''}
                  </Link>
                ) : (
                  <p className="text-[11px] text-gray-600">연결 접수 ID: {d.targetInquiryId}</p>
                )
              ) : null}
              {settlementPath ? (
                <Link
                  to={settlementPath}
                  className="mt-1 inline-block text-[11px] font-medium text-indigo-700 hover:text-indigo-900 underline"
                  onClick={onClose}
                >
                  {d.buyerKind === 'PARTNER_TENANT' ? '파트너 정산 보기' : '타업체 정산 보기'}
                </Link>
              ) : null}
              <p className="text-[10px] text-emerald-800/80">
                수수료(listingFee)는 기존 파트너·타업체 정산 집계에 반영됩니다.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">
              확정 전에는 시·구 주소와 표시금액만 확인할 수 있습니다.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {d.status === 'OPEN' && d.role === 'VIEWER' && !d.platformSuspended ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runBuyerConfirm()}
                className="rounded-lg bg-violet-700 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
              >
                갖고가기
              </button>
            ) : null}
            {d.status === 'PENDING_SELLER' && d.role === 'SELLER' && apiMode === 'admin' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runSellerConfirm()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  인계 확정
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runSellerDecline()}
                  className="rounded-lg border border-amber-300 px-4 py-2 text-fluid-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                >
                  구매 신청 거절
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-fluid-xs text-gray-700"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
