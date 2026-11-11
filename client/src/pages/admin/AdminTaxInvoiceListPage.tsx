import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../../api/apiPrefix';
import { getToken } from '../../stores/auth';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { CashbillCertRegisterModal } from '../../components/cashbill/CashbillCertRegisterModal';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ReceiptListHeader, ReceiptSummaryCards, type ReceiptConnectionStatus } from '../../components/receipts/ReceiptListHeader';
import { ReceiptIssueSettingsModal } from '../../components/receipts/ReceiptIssueSettingsModal';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ReceiptWalletProvider, ReceiptWalletRefresh } from '../../components/wallet/ReceiptWalletProvider';
import { ReceiptInquiryLinkModal } from '../../components/receipts/ReceiptInquiryLinkModal';
import { formatReceiptIssuedAt, openReceiptWindow } from '../../components/receipts/receiptListDisplay';
import {
  cancelTaxInvoice,
  linkTaxInvoiceInquiry,
  listTaxInvoices,
  syncTaxInvoiceStates,
  taxInvoiceStateOpen,
  taxStatusView,
  type TaxInvoiceBrand,
  type TaxInvoiceRow,
} from '../../api/taxInvoices';
import { markReceiptStateSynced, receiptOpenOverDay, receiptStateSyncDue } from '../../utils/receiptStateSync';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { TaxInvoiceModifyModal } from '../../components/taxinvoice/TaxInvoiceModifyModal';
import { ReceiptExtraNote } from '../../components/receipts/ReceiptExtraNote';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { certDaysLeft, formatCertExpireDot } from '../../components/cashbill/cashbillCertDisplay';
import { formatSignedWon, signedWonTextClass } from '../../utils/signedWon';
import { Button } from '../../components/ui/Button';
import { FailReasonChip, showReceiptDone, showReceiptFailure } from '../../components/receipts/receiptToasts';
import { ToastButton } from '../../components/ui/Toast';
import { useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';
import { approvalTail, groupTaxInvoiceRows, type TaxListConnect } from '../../utils/taxInvoiceListGroup';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { ReceiptSetupGate } from '../../components/receipts/ReceiptSetupGate';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';

const STATES = [
  ['', '전체 상태'],
  ['3014', '발급완료'],
  ['5031', '발급 취소'],
  ['nts1', '국세청 전송 대기'],
  ['nts23', '국세청 전송 중'],
  ['nts4', '전송완료'],
  ['nts5', '전송 실패'],
  ['amended', '수정됨'],
  ['failed', '발행 실패'],
] as const;

const ISSUE_PATH = '/admin/inquiries/receipts/taxinvoice/new';
const XL_HIDE = 'hidden xl:table-cell';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}
function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}
export function AdminTaxInvoiceListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useMarketerPermissions();
  const isTenantAdmin = permissions.me?.role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const datePreset = searchParams.get('datePreset') || 'month';
  const monthKey = searchParams.get('month') || kstMonthKeyNow();
  const dayKey = searchParams.get('day') || kstYmdNow();
  const state = searchParams.get('state') || '';
  const brandId = searchParams.get('brandId') || '';
  const queryText = searchParams.get('q') || '';
  const extraOnly = searchParams.get('extra') === '1';
  // 예전 ?tab=issue·?from= 주소는 발행 페이지로 보낸다.
  const tabParam = searchParams.get('tab');
  const legacyFrom = searchParams.get('from');
  useEffect(() => {
    if (tabParam !== 'issue' && !legacyFrom) return;
    const qs = new URLSearchParams();
    const inquiryId = searchParams.get('inquiryId');
    if (legacyFrom) qs.set('from', legacyFrom);
    else if (inquiryId) qs.set('inquiryId', inquiryId);
    navigate(`${ISSUE_PATH}${qs.toString() ? `?${qs.toString()}` : ''}`, { replace: true });
  }, [tabParam, legacyFrom, searchParams, navigate]);
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));
  const [items, setItems] = useState<TaxInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<TaxInvoiceBrand[]>([]);
  const [summary, setSummary] = useState({ issuedCount: 0, issuedWon: 0, waitingCount: 0, failedCount: 0, issueFailCount: 0, costWon: 0 });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [certBrandId, setCertBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [linkIssueId, setLinkIssueId] = useState<string | null>(null);
  const [modifyRow, setModifyRow] = useState<TaxInvoiceRow | null>(null);
  const [walletTick, setWalletTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const safePage = useMemo(() => clampListPage(page, total, pageSize), [page, total, pageSize]);

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

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set('datePreset', datePreset);
    if (datePreset === 'month') qs.set('month', monthKey);
    if (datePreset === 'day') qs.set('day', dayKey);
    if (state) qs.set('state', state);
    if (brandId) qs.set('brandId', brandId);
    if (queryText) qs.set('q', queryText);
    if (extraOnly) qs.set('extra', '1');
    qs.set('limit', String(pageSize));
    qs.set('offset', String((safePage - 1) * pageSize));
    const res = await listTaxInvoices(qs);
    setItems(res.items);
    setTotal(res.total);
    setBrands(res.brands);
    if (res.summary) setSummary(res.summary);
  }, [datePreset, monthKey, dayKey, state, brandId, queryText, extraOnly, pageSize, safePage]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(() => { if (!cancelled) setError(null); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : '불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, reload]);

  useEffect(() => {
    const issuedId = (location.state as { taxIssuedId?: string } | null)?.taxIssuedId;
    if (!issuedId) return;
    setHighlightId(issuedId);
    showReceiptDone(
      '세금계산서를 발행했어요',
      '목록 맨 위에 표시해 두었어요.',
      <>
        <ReceiptCopyButtons kind="taxinvoice" issueId={issuedId} official publicToken={null} copyReady={false} shareOnly inToast />
        <ToastButton variant="primary">확인</ToastButton>
      </>,
    );
    setReload((n) => n + 1);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    window.setTimeout(() => setHighlightId(null), 3000);
  }, [location.pathname, location.search, location.state, navigate]);

  async function cancelRow(issueId: string) {
    setCancellingId(issueId);
    try {
      await cancelTaxInvoice(issueId);
      setWalletTick((n) => n + 1);
      await load();
      showReceiptDone('발급을 취소했어요', '국세청 전송 전이라 바로 취소됐어요.');
    } catch (err) {
      showReceiptFailure('발급을 취소하지 못했어요', err instanceof Error ? err.message : '세금계산서 취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  const slots = useMemo(() => groupTaxInvoiceRows(items), [items]);
  const blocking = shouldShowListBlockingLoading(loading, items.length);

  function focusOriginal(id: string) {
    const nodes = document.querySelectorAll<HTMLElement>(`[data-tax-row="${id}"]`);
    const visible = [...nodes].find((el) => el.getClientRects().length > 0);
    visible?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 2500);
  }
  const selected = brands.find((brand) => brand.id === brandId);
  const needsLink = !loading && (brands.length === 0 || (selected ? !selected.linked : brands.every((brand) => !brand.linked)));
  const certMissing = !loading && brands.length > 0 && !brands.some((brand) => brand.linked && brand.certValid && !brand.simplified);
  const certTargets = brands.filter((brand) => brand.linked && !brand.simplified);
  const missingCert = certTargets.find((brand) => !brand.certValid) ?? null;
  const expireDates = certTargets.map((brand) => brand.certExpireDate).filter((day): day is string => Boolean(day)).sort();
  const soonestExpire = expireDates[0] ?? null;
  const connectionStatus: ReceiptConnectionStatus | null = (() => {
    if (loading) return null;
    if (needsLink) return { ok: false, label: '바로빌 미가입' };
    if (missingCert) return { ok: false, label: '바로빌 연결 · 인증서 미등록' };
    const left = certDaysLeft(soonestExpire);
    if (left != null && left < 0) return { ok: false, label: '인증서 만료' };
    if (left != null && left <= 30) return { ok: false, label: `인증서 ${left}일 남음` };
    const until = formatCertExpireDot(soonestExpire);
    return { ok: true, label: until ? `바로빌 연결 · 인증서 ${until}까지` : '바로빌 연결' };
  })();
  const goReissue = (id: string) => navigate(`${ISSUE_PATH}?from=${encodeURIComponent(id)}`);

  const TAX_SYNC_KEY = 'receipt-taxinvoice-state-sync-at';

  async function refreshStates() {
    try {
      await syncTaxInvoiceStates();
      markReceiptStateSynced(TAX_SYNC_KEY);
      setReload((n) => n + 1);
    } catch (err) {
      showReceiptFailure('상태를 새로고치지 못했어요', err instanceof Error ? err.message : null);
    }
  }

  useEffect(() => {
    if (needsLink) return;
    if (!receiptStateSyncDue(TAX_SYNC_KEY)) return;
    if (summary.waitingCount <= 0 && !items.some((row) => taxInvoiceStateOpen(row))) return;
    let stop = false;
    void syncTaxInvoiceStates()
      .then(() => {
        if (stop) return;
        markReceiptStateSynced(TAX_SYNC_KEY);
        setReload((n) => n + 1);
      })
      .catch(() => undefined);
    return () => { stop = true; };
  }, [needsLink, summary.waitingCount, items]);

  const PRESETS = [
    { value: 'today', label: '당일' },
    { value: 'week', label: '이번주' },
    { value: 'month', label: '월별' },
    { value: 'day', label: '날짜' },
  ] as const;
  type Preset = (typeof PRESETS)[number]['value'];
  const preset = (PRESETS.some((item) => item.value === datePreset) ? datePreset : 'month') as Preset;

  return (
    <ReceiptWalletProvider>
    <ReceiptSetupGate kind="taxinvoice">
    <div className="flex min-w-0 w-full max-w-[1120px] flex-col gap-2 sm:gap-4">
      <ReceiptListHeader
        title="세금계산서"
        path="/admin/inquiries/receipts/taxinvoice"
        issueLabel="+ 세금계산서 발행"
        issueDisabled={needsLink || certMissing}
        hideIssue={false}
        unitPriceKrw={TAXINVOICE_UNIT_PRICE_KRW}
        onIssue={() => navigate(ISSUE_PATH)}
        onOpenSettings={() => setSettingsOpen(true)}
        compactPc
        connectionStatus={connectionStatus}
      />
      <ReceiptIssueSettingsModal kind="taxinvoice" open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ReceiptWalletRefresh tick={walletTick} />
      <ReceiptSummaryCards {...summary} onFailed={() => patch({ state: 'nts5', page: '1' })} onIssueFailed={() => patch({ state: 'failed', page: '1' })} />
      {needsLink ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>{isTenantAdmin ? '계산서 연결을 먼저 해주세요.' : '관리자가 바로빌 가입을 마쳐야 발행할 수 있어요.'}</p>
          {isTenantAdmin ? (
            <Link to="/admin/team-leaders/cashbill" className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">계산서 연결로 가기</Link>
          ) : null}
        </div>
      ) : null}
      {certMissing && !needsLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
          {isTenantAdmin
            ? '공동인증서를 등록해야 세금계산서를 발행할 수 있습니다'
            : '세금계산서는 관리자가 공동인증서를 등록해야 해요.'}
          {isTenantAdmin ? (
            <Button size="sm" onClick={() => missingCert && setCertBrandId(missingCert.id)}>공동인증서 등록</Button>
          ) : null}
        </div>
      ) : null}
      {!needsLink ? (
        <>
          {/* PC: 필터 + 표 한 카드 */}
          <div className="hidden lg:block">
            <div className="rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                <Button size="sm" variant="quiet" className="underline" onClick={() => void refreshStates()}>상태 새로고침</Button>
                <SegmentedControl ariaLabel="발행 기간" value={preset} onChange={(next) => patch({ datePreset: next, page: '1' })} options={PRESETS.map((item) => ({ value: item.value, label: item.label }))} />
                {preset === 'month' ? <YearMonthSelect value={monthKey} onChange={(month) => patch({ month, page: '1' })} /> : null}
                {preset === 'day' ? <YmdSelect value={dayKey} onChange={(day) => patch({ day, page: '1' })} /> : null}
                <input
                  defaultValue={queryText}
                  placeholder="상호·사업자번호·고객 이름"
                  aria-label="검색"
                  className="h-9 w-[240px] rounded-lg border-0 bg-[#F4F6FA] px-3 text-fluid-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') patch({ q: (event.target as HTMLInputElement).value.trim(), page: '1' });
                  }}
                />
                <select value={state} aria-label="상태" className="h-9 rounded-lg border-0 bg-[#F4F6FA] px-2 text-fluid-xs" onChange={(e) => patch({ state: e.target.value, page: '1' })}>
                  {STATES.map(([id, label]) => <option key={id || 'all'} value={id}>{label}</option>)}
                </select>
                {brands.length > 1 ? (
                  <select value={brandId} aria-label="브랜드" className="h-9 rounded-lg border-0 bg-[#F4F6FA] px-2 text-fluid-xs" onChange={(e) => patch({ brandId: e.target.value, page: '1' })}>
                    <option value="">전체 브랜드</option>
                    {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                ) : null}
                <label className="inline-flex min-h-9 items-center gap-1.5 text-fluid-xs text-slate-600">
                  <input type="checkbox" checked={extraOnly} onChange={(event) => patch({ extra: event.target.checked ? '1' : null, page: '1' })} />
                  추가금액 있는 건만
                </label>
                <div className="ml-auto">
                  <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
                </div>
              </div>
              {error ? <p className="px-4 py-3 text-fluid-xs text-red-800">{error}</p> : null}
              {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
              {!blocking ? (
                <table className="w-full table-fixed border-collapse text-fluid-xs">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      <th className="w-[104px] px-3 py-2.5 text-center text-[12px] font-medium text-slate-600">발급일시</th>
                      <th className="px-3 py-2.5 text-left text-[12px] font-medium text-slate-600">공급받는자</th>
                      <th className={`w-[120px] px-3 py-2.5 text-left text-[12px] font-medium text-slate-600 ${XL_HIDE}`}>품목</th>
                      <th className="w-[64px] px-2 py-2.5 text-center text-[12px] font-medium text-slate-600">구분</th>
                      <th className="w-[108px] px-3 py-2.5 text-right text-[12px] font-medium text-slate-600">공급가액</th>
                      <th className="w-[92px] px-3 py-2.5 text-right text-[12px] font-medium text-slate-600">세액</th>
                      <th className="w-[140px] px-2 py-2.5 text-center text-[12px] font-medium text-slate-600">상태</th>
                      <th className="w-[120px] px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slot) => {
                      const row = slot.row;
                      return (
                        <tr key={row.id} data-tax-row={row.id} className={`border-t border-[#F1F5F9] ${highlightId === row.id ? 'bg-[#F0FDF4]' : 'hover:bg-slate-50'}`}>
                          <td className={`relative whitespace-nowrap px-3 py-3 text-center text-[12px] tabular-nums text-slate-600 ${slot.nested ? 'pl-5' : ''}`}>
                            <ConnectRail connect={slot.connect} />
                            {formatReceiptIssuedAt(row.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <p className="truncate text-[13px] font-semibold text-slate-900" title={row.buyerCorpName}>{row.buyerCorpName || '—'}</p>
                            <p className="truncate text-[11px] text-slate-500">
                              <span className="tabular-nums">{row.buyerCorpNum || '—'}</span>
                              {row.inquiryNumber ? (
                                <> · <Link className="underline-offset-2 hover:underline" to={`/admin/inquiries?q=${encodeURIComponent(row.inquiryNumber)}`}>{row.customerName} {row.inquiryNumber}</Link></>
                              ) : null}
                            </p>
                          </td>
                          <td className={`truncate px-3 py-3 text-[12px] text-slate-600 ${XL_HIDE}`} title={row.itemName || '청소 서비스'}>{row.itemName || '청소 서비스'}</td>
                          <td className="px-2 py-3 text-center"><TaxKindBadge kind={row.taxKind} /></td>
                          <td className="px-3 py-3 text-right">
                            <p className={`whitespace-nowrap text-[13px] font-medium tabular-nums ${signedWonTextClass(row.supplyAmount)}`}>{formatSignedWon(row.supplyAmount)}</p>
                            <ReceiptExtraNote amount={row.extraAmountWon} reason={row.extraReason} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-[12px] tabular-nums text-slate-600">{row.taxKind === 'exempt' ? '—' : formatSignedWon(row.taxAmount)}</td>
                          <td className="px-2 py-3 text-center">
                            <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                              <TaxStatus row={row} />
                              <OriginalLink row={row} onFocus={focusOriginal} />
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right"><RowAction compact row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onReissue={() => goReissue(row.id)} onLink={() => setLinkIssueId(row.id)} onModify={() => setModifyRow(row)} onError={(message) => showReceiptFailure('처리하지 못했어요', message)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
              {!blocking && items.length === 0 ? <p className="p-8 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
              {!loading ? (
                <div className="border-t border-slate-100 px-4 py-3">
                  <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
                </div>
              ) : null}
            </div>
          </div>

          {/* 모바일: 필터 + 카드 */}
          <div className="space-y-2 lg:hidden">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
              <Button size="sm" variant="quiet" className="underline" onClick={() => void refreshStates()}>상태 새로고침</Button>
              <SegmentedControl ariaLabel="발행 기간" value={preset} onChange={(next) => patch({ datePreset: next, page: '1' })} options={PRESETS.map((item) => ({ value: item.value, label: item.label }))} />
              {preset === 'month' ? <YearMonthSelect value={monthKey} onChange={(month) => patch({ month, page: '1' })} /> : null}
              {preset === 'day' ? <YmdSelect value={dayKey} onChange={(day) => patch({ day, page: '1' })} /> : null}
              <select value={state} aria-label="상태" className="min-h-9 rounded-lg border border-slate-300 px-2 text-fluid-xs" onChange={(e) => patch({ state: e.target.value, page: '1' })}>
                {STATES.map(([id, label]) => <option key={id || 'all'} value={id}>{label}</option>)}
              </select>
              <input
                defaultValue={queryText}
                placeholder="상호·고객명·번호"
                aria-label="검색"
                className="min-h-9 min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-2 text-fluid-xs"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') patch({ q: (event.target as HTMLInputElement).value.trim(), page: '1' });
                }}
              />
            </div>
            <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
            {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
            {!blocking ? (
              <div className="space-y-1.5">
                {mobileGroups(slots).map((group) => (
                  <div key={group[0].row.id} className={group.length > 1 ? 'space-y-1.5 border-l border-slate-300 pl-2' : 'space-y-1.5'}>
                    {group.map((slot) => (
                      <TaxCard key={slot.row.id} row={slot.row} nested={slot.nested} cancelling={cancellingId === slot.row.id} onCancel={() => void cancelRow(slot.row.id)} onReissue={() => goReissue(slot.row.id)} onLink={() => setLinkIssueId(slot.row.id)} onModify={() => setModifyRow(slot.row)} onError={(message) => showReceiptFailure('처리하지 못했어요', message)} onFocusOriginal={focusOriginal} highlight={highlightId === slot.row.id} />
                    ))}
                  </div>
                ))}
                {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
              </div>
            ) : null}
            {!loading ? <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} /> : null}
          </div>
        </>
      ) : null}
      {linkIssueId ? (
        <ReceiptInquiryLinkModal
          kind="taxinvoice"
          onClose={() => setLinkIssueId(null)}
          onPick={async (inquiryId) => {
            await linkTaxInvoiceInquiry(linkIssueId, inquiryId);
            await load();
            showReceiptDone('접수에 연결했어요', '접수 히스토리에도 남겨 두었어요.');
          }}
        />
      ) : null}
      {modifyRow ? (
        <TaxInvoiceModifyModal
          row={modifyRow}
          onClose={() => setModifyRow(null)}
          onDone={() => { setModifyRow(null); setWalletTick((n) => n + 1); setReload((n) => n + 1); showReceiptDone('수정세금계산서를 발급했어요', '원래 건 아래에 붙여 두었어요.'); }}
        />
      ) : null}
      {certBrandId ? (
        <CashbillCertRegisterModal
          operatingCompanyId={certBrandId}
          onClose={() => setCertBrandId(null)}
          onRegistered={(status) => {
            setBrands((prev) => prev.map((brand) => brand.id === certBrandId ? { ...brand, certValid: true, certExpireDate: status.expireDate } : brand));
          }}
          onIssue={() => navigate(ISSUE_PATH)}
        />
      ) : null}
    </div>
    </ReceiptSetupGate>
    </ReceiptWalletProvider>
  );
}

function taxFailed(row: TaxInvoiceRow): boolean {
  return !row.barobillState && Boolean(row.lastError);
}

function TaxKindBadge({ kind }: { kind?: TaxInvoiceRow['taxKind'] }) {
  const label = kind === 'zero' ? '영세' : kind === 'exempt' ? '면세' : '과세';
  const tone = kind === 'exempt'
    ? 'bg-[#ECFDF5] text-[#047857]'
    : kind === 'zero'
      ? 'bg-[#F5F3FF] text-[#6D28D9]'
      : 'bg-[#EFF6FF] text-[#1D4ED8]';
  return <span className={`mr-1 inline-flex rounded-full px-1.5 py-0 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function TaxStatus({ row }: { row: TaxInvoiceRow }) {
  const { openCharge } = useReceiptWallet();
  const view = taxStatusView(row);
  if (taxFailed(row)) return <FailReasonChip label={view.label} reason={row.lastError} onCharge={openCharge} />;
  const needCheck = taxInvoiceStateOpen(row) && receiptOpenOverDay(row.createdAt);
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className="inline-flex flex-wrap items-center justify-center gap-1">
        <span className={`inline-flex whitespace-nowrap rounded-full px-1.5 py-0 text-fluid-2xs ${view.className}`}>{view.label}</span>
        {needCheck ? <span className="whitespace-nowrap text-fluid-2xs font-medium text-amber-800">확인 필요</span> : null}
      </span>
      {view.detail ? <span className="whitespace-nowrap text-fluid-2xs text-slate-500">{view.detail}</span> : null}
    </span>
  );
}

function OriginalLink({ row, onFocus }: { row: TaxInvoiceRow; onFocus: (id: string) => void }) {
  if (!row.modifyCode || !row.originalIssueId) return null;
  const tail = approvalTail(row.originalNtsSendKey);
  const label = tail ? `원래 건 …${tail}` : '원래 건 보기';
  return (
    <button
      type="button"
      title="원래 세금계산서로 이동"
      className="whitespace-nowrap text-fluid-2xs leading-tight text-slate-500 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      onClick={() => onFocus(row.originalIssueId!)}
    >
      {label}
    </button>
  );
}

function ConnectRail({ connect }: { connect: TaxListConnect }) {
  if (connect === 'none') return null;
  const line = connect === 'start' ? 'top-1/2 bottom-0' : connect === 'end' ? 'top-0 h-1/2' : 'inset-y-0';
  return (
    <>
      <span className={`pointer-events-none absolute left-1 w-px bg-slate-300 ${line}`} aria-hidden />
      {connect === 'start' ? null : <span className="pointer-events-none absolute left-1 top-1/2 h-px w-2 bg-slate-300" aria-hidden />}
    </>
  );
}

function mobileGroups(slots: ReturnType<typeof groupTaxInvoiceRows>) {
  const groups: Array<typeof slots> = [];
  for (const slot of slots) {
    if (!slot.nested || groups.length === 0) groups.push([slot]);
    else groups[groups.length - 1].push(slot);
  }
  return groups;
}

function RowAction({ row, cancelling, onCancel, onReissue, onLink, onModify, onError, compact = false }: { row: TaxInvoiceRow; compact?: boolean; cancelling: boolean; onCancel: () => void; onReissue: () => void; onLink: () => void; onModify: () => void; onError: (message: string) => void }) {
  const btn = 'min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const official = row.barobillState === '3014' || row.barobillState === '5031';
  return (
    <div className={`inline-flex items-center gap-1 ${compact ? 'justify-end' : 'justify-center'}`}>
      {taxFailed(row) || row.barobillState === '5031' ? (
        compact ? <Button size="sm" onClick={onReissue}>다시 발행</Button> : <button type="button" className={`${btn} whitespace-nowrap`} onClick={onReissue}>다시 발행</button>
      ) : compact ? (
        <Button size="sm" disabled={!official} onClick={() => void openTaxMail(row.id).catch((err: unknown) => onError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>{row.taxKind === 'exempt' ? '계산서' : '영수증'}</Button>
      ) : (
        <button type="button" className={`${btn} whitespace-nowrap`} disabled={!official} onClick={() => void openTaxMail(row.id).catch((err: unknown) => onError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>{row.taxKind === 'exempt' ? '계산서' : '영수증'}</button>
      )}
      <ReceiptRowMenu
        kind="taxinvoice"
        issueId={row.id}
        official={official}
        publicToken={row.publicToken ?? null}
        copyReady={Boolean(row.copyReady)}
        canCancel={Boolean(row.canCancel)}
        cancelling={cancelling}
        onCancel={onCancel}
        onLinkInquiry={onLink}
        onModify={row.canModify ? onModify : undefined}
        compact={compact}
      />
    </div>
  );
}

async function openTaxMail(issueId: string): Promise<void> {
  const res = await fetch(`${API}/tax-invoices/${issueId}/mail-url`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) throw new Error('영수증을 열지 못했습니다.');
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error('영수증을 열지 못했습니다.');
  openReceiptWindow(body.url);
}

function TaxCard({ row, nested, cancelling, onCancel, onReissue, onLink, onModify, onError, onFocusOriginal, highlight }: { row: TaxInvoiceRow; nested: boolean; cancelling: boolean; onCancel: () => void; onReissue: () => void; onLink: () => void; onModify: () => void; onError: (message: string) => void; onFocusOriginal: (id: string) => void; highlight: boolean }) {
  return (
    <article data-tax-row={row.id} className={`space-y-1 rounded-lg border border-slate-200 p-2 ${nested ? 'ml-2' : ''} ${highlight ? 'bg-[#F0FDF4]' : 'bg-white'}`}>
      <p className="text-fluid-2xs tabular-nums text-slate-500">{formatReceiptIssuedAt(row.createdAt)}{row.issuerName ? ` · 발급 ${row.issuerName}` : ''}</p>
      <p className="truncate text-fluid-sm font-medium text-slate-900" title={row.customerName}>{row.customerName}</p>
      <p className="truncate text-fluid-xs text-slate-700" title={row.buyerCorpName}>{row.buyerCorpName} · {row.buyerCorpNum || '—'}</p>
      <div className="text-right">
        <p className={`text-fluid-sm font-semibold tabular-nums ${signedWonTextClass(row.totalAmount) || 'text-slate-900'}`}>{formatSignedWon(row.totalAmount)}</p>
        <ReceiptExtraNote amount={row.extraAmountWon} reason={row.extraReason} />
      </div>
      <p className="truncate text-fluid-2xs text-slate-600"><TaxKindBadge kind={row.taxKind} /> {row.itemName || '청소 서비스'} · {row.purposeType === 2 ? '청구' : '영수'} · <TaxStatus row={row} /></p>
      <OriginalLink row={row} onFocus={onFocusOriginal} />
      <RowAction row={row} cancelling={cancelling} onCancel={onCancel} onReissue={onReissue} onLink={onLink} onModify={onModify} onError={onError} />
    </article>
  );
}
