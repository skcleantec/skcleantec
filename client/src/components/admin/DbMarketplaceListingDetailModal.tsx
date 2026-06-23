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
  listDbMarketplaceMessages,
  postDbMarketplaceMessage,
  listTeamDbMarketplaceMessages,
  postTeamDbMarketplaceMessage,
  holdDbMarketplaceListing,
  releaseDbMarketplaceHold,
  holdTeamDbMarketplaceListing,
  releaseTeamDbMarketplaceHold,
  type DbMarketplaceListingDetail,
  type DbMarketplaceListingMessage,
  type DbMarketplaceMaskedItem,
} from '../../api/dbMarketplace';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { ModalCloseButton } from './ModalCloseButton';
import { DbMarketplaceCleaningDetailCard } from './DbMarketplaceCleaningDetailCard';
import { DB_MARKETPLACE_HOLD_MINUTES } from '@shared/dbMarketplacePolicy';
import type { DbMarketplaceAudienceItem } from '../../api/dbMarketplace';

function DbMarketplacePublishAudienceBlock({
  visibility,
  audiences,
}: {
  visibility: 'ALL' | 'SELECTED';
  audiences?: DbMarketplaceAudienceItem[];
}) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <p className="text-fluid-xs font-semibold text-violet-950">게시 대상</p>
      {visibility === 'ALL' ? (
        <p className="text-[11px] leading-relaxed text-violet-900">
          연결된 전체 파트너·등록 타업체에 노출됩니다.
        </p>
      ) : audiences && audiences.length > 0 ? (
        <ul className="space-y-1.5">
          {audiences.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-1.5 text-[11px] text-violet-950">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  a.audienceKind === 'PARTNER_TENANT'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {a.audienceKind === 'PARTNER_TENANT' ? '파트너' : '타업체'}
              </span>
              <span className="font-medium">{a.partnerTenantName ?? a.externalCompanyName ?? '—'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-gray-500">지정된 업체가 없습니다.</p>
      )}
    </div>
  );
}

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
  const [messages, setMessages] = useState<DbMarketplaceListingMessage[]>([]);
  const [canWriteMessages, setCanWriteMessages] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

  const showQna =
    row.status === 'OPEN' || row.status === 'PENDING_SELLER' || row.status === 'CONFIRMED';

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

  const loadMessages = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token || !showQna) return;
      if (!opts?.silent) setMessagesLoading(true);
      void (apiMode === 'team'
        ? listTeamDbMarketplaceMessages(token, row.id)
        : listDbMarketplaceMessages(token, row.id)
      )
        .then((r) => {
          setMessages(r.items);
          setCanWriteMessages(r.canWrite);
          setMessagesError(null);
        })
        .catch((e) => {
          setMessages([]);
          setCanWriteMessages(false);
          setMessagesError(e instanceof Error ? e.message : '문의 불러오기 실패');
        })
        .finally(() => {
          if (!opts?.silent) setMessagesLoading(false);
        });
    },
    [token, row.id, apiMode, showQna],
  );

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const lastSilentRefreshRef = useRef(0);
  const silentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 4000) return;
    lastSilentRefreshRef.current = now;
    loadDetail({ silent: true });
    loadMessages({ silent: true });
    onChanged();
  }, [loadDetail, loadMessages, onChanged]);

  const { connected: wsConnected } = useInboxRealtime(token, silentRefresh, Boolean(token));
  useVisibilityInterval(silentRefresh, token && !wsConnected ? 20000 : 0);

  const runReleaseHold = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await (apiMode === 'team'
        ? releaseTeamDbMarketplaceHold(token, row.id)
        : releaseDbMarketplaceHold(token, row.id));
      loadDetail({ silent: true });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : '예약 해제 실패');
    } finally {
      setBusy(false);
    }
  };

  const runHold = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await (apiMode === 'team'
        ? holdTeamDbMarketplaceListing(token, row.id)
        : holdDbMarketplaceListing(token, row.id));
      loadDetail({ silent: true });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : '검토 예약 실패');
    } finally {
      setBusy(false);
    }
  };

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

  const sendMessage = async () => {
    if (!token || !messageInput.trim()) return;
    setBusy(true);
    try {
      await (apiMode === 'team'
        ? postTeamDbMarketplaceMessage(token, row.id, messageInput.trim())
        : postDbMarketplaceMessage(token, row.id, messageInput.trim()));
      setMessageInput('');
      loadMessages({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const d = detail ?? (row as DbMarketplaceListingDetail);

  const linkedInquiryPath = (() => {
    if (d.status !== 'CONFIRMED') return null;
    if (d.role === 'SELLER' && d.inquiryId) {
      return `/admin/inquiries?openInquiry=${encodeURIComponent(d.inquiryId)}`;
    }
    if (!d.targetInquiryId) return null;
    return apiMode === 'team'
      ? `/team/assignments?openInquiry=${encodeURIComponent(d.targetInquiryId)}`
      : `/admin/inquiries?openInquiry=${encodeURIComponent(d.targetInquiryId)}`;
  })();

  const sellerSchedulePath =
    d.status === 'CONFIRMED' && d.role === 'SELLER' && d.inquiryId && apiMode === 'admin'
      ? `/admin/schedule?openInquiry=${encodeURIComponent(d.inquiryId)}`
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
      <div className="flex w-full max-w-lg max-h-[min(90vh,100dvh)] flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">정보공유 상세</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-3 text-fluid-xs" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading && !detail ? <p className="text-gray-500">불러오는 중…</p> : null}
          {error ? <p className="text-red-600">{error}</p> : null}

          {d.platformSuspended ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              플랫폼에 의해 일시 중지된 건입니다. 구매 신청할 수 없습니다.
            </p>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5 break-words">
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

          {d.role === 'SELLER' && apiMode === 'admin' ? (
            <DbMarketplacePublishAudienceBlock visibility={d.visibility} audiences={d.audiences} />
          ) : null}

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
                    {d.role === 'SELLER' ? ' (판매 접수)' : ''}
                    {d.inquiryFull?.inquiryNumber ? ` (${d.inquiryFull.inquiryNumber})` : ''}
                  </Link>
                ) : (
                  <p className="text-[11px] text-gray-600">연결 접수 ID: {d.targetInquiryId}</p>
                )
              ) : linkedInquiryPath ? (
                <Link
                  to={linkedInquiryPath}
                  className="inline-block text-[11px] font-medium text-sky-700 hover:text-sky-900 underline"
                  onClick={onClose}
                >
                  판매 접수 보기
                  {d.inquiryFull?.inquiryNumber ? ` (${d.inquiryFull.inquiryNumber})` : ''}
                </Link>
              ) : null}
              {sellerSchedulePath ? (
                <Link
                  to={sellerSchedulePath}
                  className="ml-2 inline-block text-[11px] font-medium text-sky-700 hover:text-sky-900 underline"
                  onClick={onClose}
                >
                  스케줄에서 보기
                </Link>
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
              <Link
                to={
                  apiMode === 'team'
                    ? `/team/db-marketplace?openListing=${encodeURIComponent(d.id)}`
                    : `/admin/db-marketplace?openListing=${encodeURIComponent(d.id)}`
                }
                className="mt-1 inline-block text-[11px] font-medium text-violet-700 hover:text-violet-900 underline"
                onClick={onClose}
              >
                정보공유 목록에서 보기
              </Link>
              <p className="text-[10px] text-emerald-800/80">
                수수료(listingFee)는 기존 파트너·타업체 정산 집계에 반영됩니다.
              </p>
            </div>
          ) : (
            <DbMarketplaceCleaningDetailCard row={d} />
          )}

          {showQna ? (
            <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
              <p className="text-fluid-xs font-semibold text-slate-900">구매 전 문의</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                전화·이메일·주소 전체 등 연락처는 적지 마세요. 갖고가기 전 질문·답변만 남겨 주세요.
              </p>
              {messagesLoading && messages.length === 0 ? (
                <p className="text-[11px] text-gray-500">문의 불러오는 중…</p>
              ) : null}
              {messagesError ? <p className="text-[11px] text-red-600">{messagesError}</p> : null}
              <div className="max-h-44 overflow-y-auto space-y-2 rounded-lg bg-gray-50 p-2">
                {messages.map((m) => (
                  <div key={m.id} className="text-[11px]">
                    <p className="font-medium text-slate-800">
                      {m.authorRole === 'SELLER' ? '판매' : '구매'} · {m.authorName}
                      <span className="ml-2 font-normal text-gray-400">
                        {new Date(m.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-gray-700">{m.body}</p>
                  </div>
                ))}
                {messages.length === 0 && !messagesLoading && !messagesError ? (
                  <p className="text-[11px] text-gray-400">아직 문의가 없습니다.</p>
                ) : null}
              </div>
              {canWriteMessages ? (
                <div className="space-y-2">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="문의 내용을 입력하세요"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={busy || !messageInput.trim()}
                    onClick={() => void sendMessage()}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    문의 등록
                  </button>
                </div>
              ) : d.status === 'CONFIRMED' ? (
                <p className="text-[10px] text-gray-500">확정 완료 — 문의 이력만 조회합니다.</p>
              ) : null}
            </div>
          ) : null}

          {d.status === 'OPEN' && d.role === 'SELLER' && d.holdActive ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              {d.holdBuyerName ?? '다른 업체'}가 검토 예약 중입니다.
              {d.heldUntil
                ? ` (~${new Date(d.heldUntil).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지)`
                : null}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-4 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {d.status === 'OPEN' && d.role === 'VIEWER' && !d.platformSuspended ? (
              <>
                {d.holdActive && !d.holdIsMine ? (
                  <p className="w-full text-[11px] text-amber-800">
                    다른 업체가 검토 예약 중입니다.
                    {d.heldUntil
                      ? ` (${new Date(d.heldUntil).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지)`
                      : null}
                  </p>
                ) : null}
                {!d.holdActive ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runHold()}
                    className="min-h-[2.75rem] w-full rounded-lg border border-violet-300 px-4 py-2 text-fluid-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50 sm:w-auto sm:min-h-0"
                  >
                    {DB_MARKETPLACE_HOLD_MINUTES}분 검토 예약
                  </button>
                ) : null}
                {d.holdIsMine ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runReleaseHold()}
                    className="min-h-[2.75rem] w-full rounded-lg border border-gray-300 px-4 py-2 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:w-auto sm:min-h-0"
                  >
                    검토 예약 해제
                  </button>
                ) : null}
                {(!d.holdActive || d.holdIsMine) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBuyerConfirm()}
                    className="min-h-[2.75rem] w-full rounded-lg bg-violet-700 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50 sm:w-auto sm:min-h-0"
                  >
                    갖고가기
                  </button>
                )}
              </>
            ) : null}
            {d.status === 'PENDING_SELLER' && d.role === 'SELLER' && apiMode === 'admin' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runSellerConfirm()}
                  className="min-h-[2.75rem] w-full rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:min-h-0"
                >
                  인계 확정
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runSellerDecline()}
                  className="min-h-[2.75rem] w-full rounded-lg border border-amber-300 px-4 py-2 text-fluid-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 sm:w-auto sm:min-h-0"
                >
                  구매 신청 거절
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="min-h-[2.75rem] w-full rounded-lg border border-gray-300 px-4 py-2 text-fluid-xs text-gray-700 sm:w-auto sm:min-h-0"
              onClick={onClose}
            >
              닫기
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
