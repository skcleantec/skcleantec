import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  cancelCashbillIssue,
  cashbillStateOpen,
  cashbillStatusView,
  linkCashbillInquiry,
  listCashbillIssues,
  openCashbillReceipt,
  syncCashbillStates,
  type CashbillIssueRow,
} from '../../api/cashbillIssues';
import { markReceiptStateSynced, receiptOpenOverDay, receiptStateSyncDue } from '../../utils/receiptStateSync';
import { certDaysLeft, formatCertExpireDot } from '../../components/cashbill/cashbillCertDisplay';
import { fetchCashbillSettings } from '../../api/cashbill';
import { ReceiptExtraNote } from '../../components/receipts/ReceiptExtraNote';
import { ReceiptInquiryLinkModal } from '../../components/receipts/ReceiptInquiryLinkModal';
import { ReceiptListHeader, ReceiptSummaryCards, type ReceiptConnectionStatus } from '../../components/receipts/ReceiptListHeader';
import { ReceiptIssueSettingsModal } from '../../components/receipts/ReceiptIssueSettingsModal';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ReceiptWalletProvider, ReceiptWalletRefresh } from '../../components/wallet/ReceiptWalletProvider';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { formatSignedWon, signedWonTextClass } from '../../utils/signedWon';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { Button } from '../../components/ui/Button';
import { FailReasonChip, showReceiptDone, showReceiptFailure } from '../../components/receipts/receiptToasts';
import { useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';
import { displayReceiptBiz, displayReceiptPhone, formatReceiptIssuedAt } from '../../components/receipts/receiptListDisplay';
import { CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { ReceiptSetupGate } from '../../components/receipts/ReceiptSetupGate';
import { defaultBrand, isBarobillJoined } from '../../components/receipts/receiptSetupState';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';
import { SegmentedControl } from '../../components/ui/SegmentedControl';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}
function kstLastMonthKey(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}
function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

type PeriodSeg = 'thisMonth' | 'lastMonth' | 'custom';

function toPeriodSeg(datePreset: string, monthKey: string): PeriodSeg {
  if (datePreset === 'day') return 'custom';
  if (monthKey === kstLastMonthKey()) return 'lastMonth';
  return 'thisMonth';
}

export function AdminCashbillListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useMarketerPermissions();
  const isTenantAdmin = permissions.me?.role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();

  // ?tab=issue 리디렉션
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (tabParam === 'issue') {
      const inquiryId = searchParams.get('inquiryId') || '';
      const from = searchParams.get('from') || '';
      const target = `/admin/inquiries/receipts/cashbill/new${
        inquiryId ? `?inquiryId=${encodeURIComponent(inquiryId)}` :
        from ? `?from=${encodeURIComponent(from)}` : ''
      }`;
      navigate(target, { replace: true });
    }
  }, [tabParam, searchParams, navigate]);

  const datePreset = searchParams.get('datePreset') || 'month';
  const monthKey = searchParams.get('month') || kstMonthKeyNow();
  const dayKey = searchParams.get('day') || kstYmdNow();
  const queryText = searchParams.get('q') || '';
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));

  const [items, setItems] = useState<CashbillIssueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ issuedCount: 0, issuedWon: 0, waitingCount: 0, failedCount: 0, costWon: 0 });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [linkIssueId, setLinkIssueId] = useState<string | null>(null);
  const [walletTick, setWalletTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ReceiptConnectionStatus | null>(null);
  const safePage = useMemo(() => clampListPage(page, total, pageSize), [page, total, pageSize]);

  // location.state로 넘어온 highlightId 처리
  const highlightHandledRef = useRef(false);
  useEffect(() => {
    if (highlightHandledRef.current) return;
    const stateHighlight = (location.state as { highlightId?: string } | null)?.highlightId;
    if (!stateHighlight) return;
    highlightHandledRef.current = true;
    setHighlightId(stateHighlight);
    navigate(location.pathname + location.search, { replace: true, state: null });
    window.setTimeout(() => setHighlightId(null), 3000);
  }, [location.state, location.pathname, location.search, navigate]);

  useEffect(() => {
    let stop = false;
    fetchCashbillSettings()
      .then((settings) => {
        if (stop) return;
        const brand = defaultBrand(settings);
        const member = brand?.member ?? null;
        if (!isBarobillJoined(member)) {
          setConnectionStatus({ ok: false, label: '바로빌 미가입' });
          return;
        }
        if (!member?.certValid) {
          setConnectionStatus({ ok: false, label: '바로빌 연결 · 인증서 미등록' });
          return;
        }
        const left = certDaysLeft(member.certExpireDate);
        if (left != null && left < 0) {
          setConnectionStatus({ ok: false, label: '인증서 만료' });
          return;
        }
        if (left != null && left <= 30) {
          setConnectionStatus({ ok: false, label: `인증서 ${left}일 남음` });
          return;
        }
        const until = formatCertExpireDot(member.certExpireDate);
        setConnectionStatus({
          ok: true,
          label: until ? `바로빌 연결 · 인증서 ${until}까지` : '바로빌 연결',
        });
      })
      .catch(() => { if (!stop) setConnectionStatus(null); });
    return () => { stop = true; };
  }, [reload]);

  const patch = useCallback((next: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const qs = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(next)) {
        if (!value) qs.delete(key);
        else qs.set(key, value);
      }
      return qs;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('datePreset', datePreset);
    if (datePreset === 'month') qs.set('month', monthKey);
    if (datePreset === 'day') qs.set('day', dayKey);
    if (queryText) qs.set('q', queryText);
    qs.set('limit', String(pageSize));
    qs.set('offset', String((safePage - 1) * pageSize));
    let cancelled = false;
    setLoading(true);
    listCashbillIssues(qs)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        if (res.summary) setSummary(res.summary);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [datePreset, monthKey, dayKey, queryText, pageSize, safePage, reload]);

  const CASH_SYNC_KEY = 'receipt-cashbill-state-sync-at';

  async function refreshStates() {
    try {
      await syncCashbillStates();
      markReceiptStateSynced(CASH_SYNC_KEY);
      setReload((n) => n + 1);
    } catch (err) {
      showReceiptFailure('상태를 새로고치지 못했어요', err instanceof Error ? err.message : null);
    }
  }

  async function cancelRow(issueId: string) {
    setCancellingId(issueId);
    try {
      await cancelCashbillIssue(issueId, crypto.randomUUID());
      setWalletTick((n) => n + 1);
      setReload((n) => n + 1);
      showReceiptDone('발급을 취소했어요', '국세청에 취소분이 함께 전송됩니다.');
    } catch (err) {
      showReceiptFailure('발급을 취소하지 못했어요', err instanceof Error ? err.message : '현금영수증 취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  const blocking = shouldShowListBlockingLoading(loading, items.length);

  const needsLink = !loading && items.length === 0 && summary.issuedCount === 0;

  useEffect(() => {
    if (needsLink) return;
    if (!receiptStateSyncDue(CASH_SYNC_KEY)) return;
    if (summary.waitingCount <= 0 && !items.some((row) => cashbillStateOpen(row))) return;
    let stop = false;
    void syncCashbillStates()
      .then(() => {
        if (stop) return;
        markReceiptStateSynced(CASH_SYNC_KEY);
        setReload((n) => n + 1);
      })
      .catch(() => undefined);
    return () => { stop = true; };
  }, [needsLink, summary.waitingCount, items]);

  const period = toPeriodSeg(datePreset, monthKey);

  function setPeriod(next: PeriodSeg) {
    if (next === 'custom') {
      patch({ datePreset: 'day', page: '1' });
    } else if (next === 'lastMonth') {
      patch({ datePreset: 'month', month: kstLastMonthKey(), page: '1' });
    } else {
      patch({ datePreset: 'month', month: kstMonthKeyNow(), page: '1' });
    }
  }

  return (
    <ReceiptWalletProvider>
    <ReceiptSetupGate kind="cashbill">
    <div className="flex min-w-0 w-full max-w-[1120px] flex-col gap-2 sm:gap-4">
      <ReceiptListHeader
        title="현금영수증"
        path="/admin/inquiries/receipts/cashbill"
        issueLabel="+ 현금영수증 발행"
        issueDisabled={false}
        hideIssue={false}
        unitPriceKrw={CASHBILL_UNIT_PRICE_KRW}
        onIssue={() => navigate('/admin/inquiries/receipts/cashbill/new')}
        onOpenSettings={() => setSettingsOpen(true)}
        compactPc
        connectionStatus={connectionStatus}
      />
      <ReceiptIssueSettingsModal kind="cashbill" open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ReceiptWalletRefresh tick={walletTick} />

      {/* 요약 카드 */}
      <ReceiptSummaryCards {...summary} onFailed={() => patch({ datePreset: 'month', month: kstMonthKeyNow(), page: '1' })} />

      {/* needsLink 안내 */}
      {needsLink && !loading ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>{isTenantAdmin ? '계산서 연결을 먼저 해주세요.' : '관리자가 바로빌 가입을 마쳐야 발행할 수 있어요.'}</p>
          {isTenantAdmin ? (
            <Link
              to="/admin/team-leaders/cashbill"
              className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              계산서 연결로 가기
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* PC 테이블 카드 (필터 포함) */}
      <div className="hidden lg:block">
        <div className="rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
          {/* 필터 행 */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
            <Button size="sm" variant="quiet" className="underline" onClick={() => void refreshStates()}>상태 새로고침</Button>
            <SegmentedControl
              ariaLabel="발행 기간"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'thisMonth', label: '이번 달' },
                { value: 'lastMonth', label: '지난 달' },
                { value: 'custom', label: '직접' },
              ]}
            />
            {period === 'custom' ? (
              <YmdSelect value={dayKey} onChange={(day) => patch({ day, page: '1' })} />
            ) : null}
            <input
              defaultValue={queryText}
              placeholder="고객명·발급번호·접수번호"
              aria-label="검색"
              className="h-9 w-[280px] rounded-lg border-0 bg-[#F4F6FA] px-3 text-fluid-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onKeyDown={(event) => {
                if (event.key === 'Enter') patch({ q: (event.target as HTMLInputElement).value.trim(), page: '1' });
              }}
            />
            <div className="ml-auto">
              <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
            </div>
          </div>

          {error ? <p className="px-4 py-3 text-fluid-xs text-red-800">{error}</p> : null}
          {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}

          {!blocking ? (
            <table className="w-full table-fixed border-collapse text-fluid-xs">
              <thead style={{ background: '#F8FAFC' }}>
                <tr>
                  <th style={{ width: '110px' }} className="px-3 py-2.5 text-center text-[12px] font-medium text-slate-600">발행일</th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-medium text-slate-600">고객</th>
                  <th style={{ width: '140px' }} className="px-3 py-2.5 text-center text-[12px] font-medium text-slate-600">휴대폰·사업자</th>
                  <th style={{ width: '80px' }} className="px-3 py-2.5 text-center text-[12px] font-medium text-slate-600">구분</th>
                  <th style={{ width: '120px' }} className="px-3 py-2.5 text-right text-[12px] font-medium text-slate-600">금액</th>
                  <th style={{ width: '110px' }} className="px-3 py-2.5 text-center text-[12px] font-medium text-slate-600">상태</th>
                  <th style={{ width: '44px' }} className="px-1 py-2.5 text-center text-[12px] font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={`border-t border-[#F1F5F9] ${highlightId === row.id ? 'bg-[#F0FDF4]' : 'hover:bg-slate-50'}`}>
                    <td className="whitespace-nowrap px-3 py-3 text-center tabular-nums text-slate-600 text-[12px]">{formatReceiptIssuedAt(row.createdAt)}</td>
                    <td className="px-3 py-3">
                      <PcCustomerCell row={row} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <p className="truncate tabular-nums text-slate-900 text-[12px]" title={identityText(row)}>{identityText(row)}</p>
                      <p className="text-[11px] text-slate-500">{usageLabel(row)}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TaxKindBadge kind={row.taxKind} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className={`whitespace-nowrap font-medium tabular-nums text-[13px] ${signedWonTextClass(row.totalWon)}`}>{formatSignedWon(row.totalWon)}</p>
                      <ReceiptExtraNote amount={row.extraAmountWon} reason={row.extraReason} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusDot row={row} />
                    </td>
                    <td className="px-1 py-3 text-center">
                      <ReceiptRowMenu
                        kind="cashbill"
                        issueId={row.id}
                        official={canViewReceipt(row)}
                        publicToken={row.publicToken ?? null}
                        copyReady={Boolean(row.copyReady)}
                        canCancel={Boolean(row.canCancel)}
                        cancelling={cancellingId === row.id}
                        onCancel={() => void cancelRow(row.id)}
                        onLinkInquiry={row.kind === 'CANCEL' ? undefined : () => setLinkIssueId(row.id)}
                        onModify={isFailedRow(row) || row.barobillState === '7000' || row.kind === 'CANCEL' ? () => navigate(`/admin/inquiries/receipts/cashbill/new?from=${encodeURIComponent(row.id)}`) : undefined}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {!blocking && items.length === 0 ? <p className="p-8 text-center text-fluid-sm text-slate-500">발급 내역이 없습니다.</p> : null}

          {!loading ? (
            <div className="border-t border-slate-100 px-4 py-3">
              <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
            </div>
          ) : null}
        </div>
      </div>

      {/* 모바일 필터 + 카드 */}
      <div className="lg:hidden">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
          <Button size="sm" variant="quiet" className="underline" onClick={() => void refreshStates()}>상태 새로고침</Button>
          <SegmentedControl
            ariaLabel="발행 기간"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'thisMonth', label: '이번 달' },
              { value: 'lastMonth', label: '지난 달' },
                { value: 'custom', label: '직접' },
              ]}
            />
            {period === 'custom' ? (
              <YmdSelect value={dayKey} onChange={(day) => patch({ day, page: '1' })} />
            ) : null}
            <input
              defaultValue={queryText}
              placeholder="고객명·발급번호"
              aria-label="검색"
              className="min-h-9 min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-2 text-fluid-xs"
            onKeyDown={(event) => {
              if (event.key === 'Enter') patch({ q: (event.target as HTMLInputElement).value.trim(), page: '1' });
            }}
          />
        </div>

        <div className="mt-2">
          <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
        </div>

        {error ? <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
        {blocking ? <p className="mt-4 p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}

        {!blocking ? (
          <div className="mt-2 space-y-2">
            {items.map((row) => (
              <CashbillCard
                key={row.id}
                row={row}
                cancelling={cancellingId === row.id}
                onCancel={() => void cancelRow(row.id)}
                onError={(message) => showReceiptFailure('처리하지 못했어요', message)}
                onReissue={() => navigate(`/admin/inquiries/receipts/cashbill/new?from=${encodeURIComponent(row.id)}`)}
                onLink={() => setLinkIssueId(row.id)}
                highlight={highlightId === row.id}
              />
            ))}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발급 내역이 없습니다.</p> : null}
          </div>
        ) : null}

        {!loading ? (
          <div className="mt-2">
            <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
          </div>
        ) : null}
      </div>

      {linkIssueId ? (
        <ReceiptInquiryLinkModal
          kind="cashbill"
          onClose={() => setLinkIssueId(null)}
          onPick={async (inquiryId) => {
            await linkCashbillInquiry(linkIssueId, inquiryId);
            setReload((n) => n + 1);
            showReceiptDone('접수에 연결했어요', '접수 히스토리에도 남겨 두었어요.');
          }}
        />
      ) : null}
    </div>
    </ReceiptSetupGate>
    </ReceiptWalletProvider>
  );
}

function usageLabel(row: CashbillIssueRow): string {
  if (row.kind === 'CANCEL') return '취소';
  if (row.tradeUsage === 2) return '지출증빙';
  if (row.identityMasked === '자진발급') return '자진발급';
  return '소득공제';
}

function TaxKindBadge({ kind }: { kind?: CashbillIssueRow['taxKind'] }) {
  const exempt = kind === 'exempt';
  return (
    <span
      className="inline-flex rounded-full px-1.5 py-0 text-[11px] font-medium"
      style={exempt ? { background: '#ECFDF5', color: '#047857' } : { background: '#EFF6FF', color: '#1D4ED8' }}
    >
      {exempt ? '면세' : '과세'}
    </span>
  );
}

function identityText(row: CashbillIssueRow): string {
  if (row.identityMasked === '자진발급') return '010-000-1234';
  const text = row.tradeUsage === 2 ? displayReceiptBiz(row.identityMasked) : displayReceiptPhone(row.identityMasked);
  return text && text !== '—' ? text : '—';
}

function customerNameOf(row: CashbillIssueRow): string | null {
  const name = row.customerName?.trim() ?? '';
  return name && name !== '매칭 없음' ? name : null;
}

function isFailedRow(row: CashbillIssueRow): boolean {
  return row.barobillState === '4000' || (!row.barobillState && Boolean(row.lastError));
}

function canViewReceipt(row: CashbillIssueRow): boolean {
  return row.barobillState === '2000' || row.barobillState === '2500' || row.barobillState === '3000' || row.barobillState === '7000';
}

function PcCustomerCell({ row }: { row: CashbillIssueRow }) {
  const name = customerNameOf(row);
  return (
    <div className="min-w-0">
      {name ? (
        <p className="truncate text-[13px] font-semibold text-slate-900" title={name}>{name}</p>
      ) : (
        <p className="truncate text-[12px] text-slate-400">연계 없음</p>
      )}
      {row.inquiryNumber ? (
        <Link
          className="text-[11px] text-slate-500 underline-offset-2 hover:underline"
          to={`/admin/inquiries?q=${encodeURIComponent(row.inquiryNumber)}`}
        >
          {row.inquiryNumber}
        </Link>
      ) : name && !row.linked ? (
        <p className="text-[11px] text-slate-400">직접 입력</p>
      ) : null}
    </div>
  );
}

function StatusDot({ row }: { row: CashbillIssueRow }) {
  const { openCharge } = useReceiptWallet();
  const view = cashbillStatusView(row);
  if (isFailedRow(row) && row.kind !== 'CANCEL') {
    return <FailReasonChip label={view.label} reason={row.lastError} onCharge={openCharge} />;
  }
  const needCheck = cashbillStateOpen(row) && receiptOpenOverDay(row.createdAt);
  const dot = view.className?.includes('emerald') ? '#10b981' : view.className?.includes('amber') ? '#f59e0b' : '#94a3b8';
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 text-[12px]">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} aria-hidden />
        <span className={view.className}>{view.label}</span>
      </span>
      {needCheck ? <span className="text-[11px] font-medium text-amber-700">확인 필요</span> : null}
      {view.detail ? <span className="text-[11px] text-slate-500">{view.detail}</span> : null}
    </span>
  );
}

function CashbillCard({ row, cancelling, onCancel, onError, onReissue, onLink, highlight }: {
  row: CashbillIssueRow;
  cancelling: boolean;
  onCancel: () => void;
  onError: (message: string) => void;
  onReissue: () => void;
  onLink: () => void;
  highlight: boolean;
}) {
  const name = customerNameOf(row);
  const view = cashbillStatusView(row);
  const failed = isFailedRow(row);
  return (
    <article className={`space-y-1.5 rounded-xl border border-slate-200 p-3 ${highlight ? 'bg-[#F0FDF4]' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {name ? <p className="truncate text-fluid-sm font-semibold text-slate-900">{name}</p> : <p className="text-fluid-sm text-slate-400">연계 없음</p>}
          <p className="truncate text-fluid-2xs tabular-nums text-slate-500">{identityText(row)} · {usageLabel(row)}{name && !row.linked ? ' · 직접 입력' : ''}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-fluid-sm font-semibold tabular-nums ${signedWonTextClass(row.totalWon) || 'text-slate-900'}`}>{formatSignedWon(row.totalWon)}</p>
          <ReceiptExtraNote amount={row.extraAmountWon} reason={row.extraReason} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fluid-2xs text-slate-500">
        <span className="tabular-nums">{formatReceiptIssuedAt(row.createdAt)}</span>
        <TaxKindBadge kind={row.taxKind} />
        <span className={view.className}>{view.label}</span>
        {row.issuerName ? <span className="truncate">발급 {row.issuerName}</span> : null}
      </div>
      <div className="flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
        {failed || row.barobillState === '7000' || row.kind === 'CANCEL' ? (
          <Button size="sm" onClick={onReissue}>다시 발행</Button>
        ) : (
          <Button size="sm" disabled={!canViewReceipt(row)} onClick={() => void openCashbillReceipt(row.id).catch((err: unknown) => onError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>
            영수증
          </Button>
        )}
        <ReceiptRowMenu
          kind="cashbill"
          issueId={row.id}
          official={canViewReceipt(row)}
          publicToken={row.publicToken ?? null}
          copyReady={Boolean(row.copyReady)}
          canCancel={Boolean(row.canCancel)}
          cancelling={cancelling}
          onCancel={onCancel}
          onLinkInquiry={row.kind === 'CANCEL' ? undefined : onLink}
          onModify={failed || row.barobillState === '7000' || row.kind === 'CANCEL' ? onReissue : undefined}
          compact
        />
      </div>
    </article>
  );
}
