import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  confirmDbMarketplaceBuyer,
  confirmDbMarketplaceSeller,
  declineDbMarketplaceBuyer,
  declineDbMarketplaceSeller,
  getDbMarketplaceListing,
  removeDbMarketplaceFromCart,
  revertDbMarketplaceToCart,
  confirmTeamDbMarketplaceBuyer,
  declineTeamDbMarketplaceBuyer,
  getTeamDbMarketplaceListing,
  listDbMarketplaceMessages,
  postDbMarketplaceMessage,
  listTeamDbMarketplaceMessages,
  postTeamDbMarketplaceMessage,
  type DbMarketplaceListingDetail,
  type DbMarketplaceListingMessage,
  type DbMarketplaceMaskedItem,
} from '../../api/dbMarketplace';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { ModalCloseButton } from './ModalCloseButton';
import { DbMarketplaceCleaningDetailCard } from './DbMarketplaceCleaningDetailCard';
import { DbMarketplaceAmountSummaryBlock } from '../db-marketplace/DbMarketplaceAmountSummary';
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

type DbMarketplaceDetailNavTone = 'sky' | 'indigo' | 'violet';

function dbMarketplaceDetailNavToneClass(tone: DbMarketplaceDetailNavTone): string {
  switch (tone) {
    case 'indigo':
      return 'border-indigo-200 bg-indigo-50/70 text-indigo-950 hover:bg-indigo-100/90 active:bg-indigo-100';
    case 'violet':
      return 'border-violet-200 bg-violet-50/70 text-violet-950 hover:bg-violet-100/90 active:bg-violet-100';
    default:
      return 'border-sky-200 bg-sky-50/70 text-sky-950 hover:bg-sky-100/90 active:bg-sky-100';
  }
}

function DbMarketplaceDetailNavButton({
  to,
  onClick,
  tone = 'sky',
  children,
}: {
  to: string;
  onClick?: () => void;
  tone?: DbMarketplaceDetailNavTone;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`inline-flex min-h-[2.125rem] items-center justify-center rounded-lg border px-3 py-1.5 text-[11px] font-semibold leading-snug shadow-sm transition-colors touch-manipulation ${dbMarketplaceDetailNavToneClass(tone)}`}
    >
      {children}
    </Link>
  );
}

type Props = {
  row: DbMarketplaceMaskedItem;
  onClose: () => void;
  onChanged: () => void;
  apiMode?: 'admin' | 'team';
  token?: string | null;
};

function canShowBuyerPriorityDecline(row: DbMarketplaceMaskedItem): boolean {
  return (
    row.status === 'OPEN' &&
    row.role === 'VIEWER' &&
    !row.platformSuspended &&
    row.offerMode === 'PRIORITY' &&
    row.currentPriorityRank != null
  );
}

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

  const runBuyerConfirm = async () => {
    if (!token || !window.confirm('구매신청하시겠습니까? 먼저 신청한 업체가 구매됩니다. 판매자 인계 확정 후 전체 정보가 공개됩니다.')) return;
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

  const runBuyerPriorityDecline = async () => {
    const rank = (detail ?? row).currentPriorityRank;
    if (
      !token ||
      !window.confirm(
        rank === 3
          ? '이 DB를 거절할까요? 3순위까지 거절되면 판매자 장바구니로 돌아갑니다.'
          : '이 DB를 거절할까요?',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await (apiMode === 'team'
        ? declineTeamDbMarketplaceBuyer(token, row.id)
        : declineDbMarketplaceBuyer(token, row.id));
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '거절 실패');
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

  const runRemoveFromCart = async () => {
    if (
      !token ||
      !window.confirm('정보공유 등록을 취소하고 접수를 원상복귀합니다. 계속할까요?')
    ) {
      return;
    }
    setBusy(true);
    try {
      await removeDbMarketplaceFromCart(token, row.id);
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '원상복귀 실패');
    } finally {
      setBusy(false);
    }
  };

  const runRevertToCart = async () => {
    if (
      !token ||
      !window.confirm('게시를 중단하고 장바구니로 되돌립니다. 노출 업체 설정은 유지됩니다. 계속할까요?')
    ) {
      return;
    }
    setBusy(true);
    try {
      await revertDbMarketplaceToCart(token, row.id);
      onChanged();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '장바구니 되돌리기 실패');
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

          {canShowBuyerPriorityDecline(d) ? (
            <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] text-violet-900">
              순위 노출 — 현재 {d.currentPriorityRank}순위 구매 후보입니다. 구매하지 않으면 「거절하기」를
              이용하세요.
            </p>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5 break-words">
            <p>
              <span className="text-gray-500">판매 업체</span> {d.sellerTenantName}
            </p>
            <DbMarketplaceAmountSummaryBlock
              row={{
                customerBalanceAmount: d.customerBalanceAmount,
                displayAmount: d.displayAmount,
                listingFee: d.listingFee,
                priorFeesTotal: d.priorFeesTotal,
                buyerTotalFee: d.buyerTotalFee,
              }}
            />
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
              {(() => {
                const linkedLabel = d.targetInquiryId
                  ? linkedInquiryPath
                    ? `연결 접수 보기${d.role === 'SELLER' ? ' (판매 접수)' : ''}${
                        d.inquiryFull?.inquiryNumber ? ` (${d.inquiryFull.inquiryNumber})` : ''
                      }`
                    : null
                  : linkedInquiryPath
                    ? `판매 접수 보기${
                        d.inquiryFull?.inquiryNumber ? ` (${d.inquiryFull.inquiryNumber})` : ''
                      }`
                    : null;
                return (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {linkedLabel && linkedInquiryPath ? (
                      <DbMarketplaceDetailNavButton to={linkedInquiryPath} onClick={onClose}>
                        {linkedLabel}
                      </DbMarketplaceDetailNavButton>
                    ) : d.targetInquiryId && !linkedInquiryPath ? (
                      <p className="w-full text-[11px] text-gray-600">연결 접수 ID: {d.targetInquiryId}</p>
                    ) : null}
                    {sellerSchedulePath ? (
                      <DbMarketplaceDetailNavButton to={sellerSchedulePath} onClick={onClose}>
                        스케줄에서 보기
                      </DbMarketplaceDetailNavButton>
                    ) : null}
                    {settlementPath ? (
                      <DbMarketplaceDetailNavButton
                        to={settlementPath}
                        onClick={onClose}
                        tone="indigo"
                      >
                        {d.buyerKind === 'PARTNER_TENANT' ? '파트너 정산 보기' : '타업체 정산 보기'}
                      </DbMarketplaceDetailNavButton>
                    ) : null}
                    <DbMarketplaceDetailNavButton
                      to={
                        apiMode === 'team'
                          ? `/team/db-marketplace?openListing=${encodeURIComponent(d.id)}`
                          : `/admin/db-marketplace?openListing=${encodeURIComponent(d.id)}`
                      }
                      onClick={onClose}
                      tone="violet"
                    >
                      정보공유 목록에서 보기
                    </DbMarketplaceDetailNavButton>
                  </div>
                );
              })()}
              <p className="text-[10px] text-emerald-800/80">
                정보공유 수수료는 인계 확정 시 파트너·타업체 정산에 반영됩니다. 재판매 건은 앞선 판매 수수료가 합산됩니다.
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

          <div className="sticky bottom-0 -mx-4 border-t border-gray-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {d.status === 'OPEN' && d.role === 'VIEWER' && !d.platformSuspended ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runBuyerConfirm()}
                  className="min-h-[2.75rem] w-full rounded-lg bg-violet-700 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50 sm:w-auto sm:min-h-0"
                >
                  구매신청
                </button>
                {canShowBuyerPriorityDecline(d) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBuyerPriorityDecline()}
                    className="min-h-[2.75rem] w-full rounded-lg border border-amber-300 px-4 py-2 text-fluid-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 sm:w-auto sm:min-h-0"
                  >
                    거절하기
                  </button>
                ) : null}
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
            {d.status === 'DRAFT' && d.role === 'SELLER' && apiMode === 'admin' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runRemoveFromCart()}
                className="min-h-[2.75rem] w-full rounded-lg border border-gray-300 px-4 py-2 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 sm:w-auto sm:min-h-0"
              >
                원상복귀
              </button>
            ) : null}
            {d.status === 'OPEN' && d.role === 'SELLER' && apiMode === 'admin' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runRevertToCart()}
                className="min-h-[2.75rem] w-full rounded-lg border border-violet-300 px-4 py-2 text-fluid-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50 sm:w-auto sm:min-h-0"
              >
                장바구니로 되돌리기
              </button>
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
