import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../../api/apiPrefix';
import { getToken } from '../../stores/auth';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { CashbillCertRegisterModal } from '../../components/cashbill/CashbillCertRegisterModal';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ReceiptListHeader, ReceiptSummaryCards } from '../../components/receipts/ReceiptListHeader';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ReceiptWalletProvider, ReceiptWalletRefresh } from '../../components/wallet/ReceiptWalletProvider';
import { ApprovalNumberCell } from '../../components/receipts/ApprovalNumberCell';
import { ReceiptInquiryLinkModal } from '../../components/receipts/ReceiptInquiryLinkModal';
import { formatReceiptIssuedAt, openReceiptWindow } from '../../components/receipts/receiptListDisplay';
import {
  cancelTaxInvoice,
  linkTaxInvoiceInquiry,
  listTaxInvoices,
  taxStatusView,
  type TaxInvoiceBrand,
  type TaxInvoiceRow,
} from '../../api/taxInvoices';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { TaxInvoiceCertBand } from '../../components/taxinvoice/TaxInvoiceCertBand';
import { TaxInvoiceModifyModal } from '../../components/taxinvoice/TaxInvoiceModifyModal';
import { formatSignedWon, signedWonTextClass } from '../../utils/signedWon';
import { Button } from '../../components/ui/Button';
import { FailReasonChip, showReceiptDone, showReceiptFailure } from '../../components/receipts/receiptToasts';
import { ToastButton } from '../../components/ui/Toast';
import { useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';
import { approvalTail, groupTaxInvoiceRows, type TaxListConnect } from '../../utils/taxInvoiceListGroup';

const SEG = 'rounded-md px-2 py-1 text-fluid-2xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const SEG_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const STATES = [
  ['', '전체 상태'],
  ['3014', '발급완료'],
  ['5031', '발급 취소'],
  ['nts1', '국세청 전송 대기'],
  ['nts23', '국세청 전송 중'],
  ['nts4', '국세청 전송 완료'],
  ['nts5', '전송 실패'],
  ['amended', '수정됨'],
  ['failed', '발행 실패'],
] as const;

/** PC 표 열. 좁은 화면(1440 미만)에서는 덜 중요한 열을 숨기고, 1280 미만에서는 승인번호도 숨긴다. */
const NARROW_HIDE = 'hidden min-[1440px]:table-cell';
const XL_HIDE = 'hidden xl:table-cell';
const TAX_COLS: Array<{ key: string; label: string; width?: string; hide?: string }> = [
  { key: 'at', label: '발급일시', width: 'w-[108px]' },
  { key: 'customer', label: '고객' },
  { key: 'corp', label: '상호' },
  { key: 'corpNum', label: '사업자번호', width: 'w-[120px]' },
  { key: 'kind', label: '과세구분', width: 'w-[72px]', hide: NARROW_HIDE },
  { key: 'item', label: '품목', hide: NARROW_HIDE },
  { key: 'amount', label: '금액', width: 'w-[112px]' },
  { key: 'purpose', label: '영수/청구', width: 'w-[80px]', hide: NARROW_HIDE },
  { key: 'status', label: '상태', width: 'w-[180px]' },
  { key: 'approval', label: '승인번호', width: 'w-[140px]', hide: XL_HIDE },
  { key: 'by', label: '발급자', width: 'w-[84px]' },
  { key: 'act', label: '', width: 'w-[128px]' },
];

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}
function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}
export function AdminTaxInvoiceListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const datePreset = searchParams.get('datePreset') || 'today';
  const monthKey = searchParams.get('month') || kstMonthKeyNow();
  const dayKey = searchParams.get('day') || kstYmdNow();
  const state = searchParams.get('state') || '';
  const brandId = searchParams.get('brandId') || '';
  const queryText = searchParams.get('q') || '';
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
    qs.set('limit', String(pageSize));
    qs.set('offset', String((safePage - 1) * pageSize));
    const res = await listTaxInvoices(qs);
    setItems(res.items);
    setTotal(res.total);
    setBrands(res.brands);
    if (res.summary) setSummary(res.summary);
  }, [datePreset, monthKey, dayKey, state, brandId, queryText, pageSize, safePage]);

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
    window.setTimeout(() => setHighlightId(null), 4000);
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
  const bandBrand = certTargets.find((brand) => brand.certExpireDate === soonestExpire) ?? certTargets[0] ?? null;
  const certChip = !needsLink && certTargets.length > 0
    ? missingCert
      ? { id: missingCert.id, label: '인증서 미등록', className: 'border-amber-300 bg-amber-50 text-amber-950' }
      : { id: certTargets[0].id, label: `인증서 ~${(expireDates[0] ?? '').slice(0, 10)}`, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
    : null;

  return (
    <ReceiptWalletProvider>
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <ReceiptListHeader
        title="세금계산서"
        path="/admin/inquiries/receipts/taxinvoice"
        issueLabel="+ 세금계산서 발행"
        issueDisabled={needsLink || certMissing}
        onIssue={() => navigate('/admin/inquiries/receipts/taxinvoice/new')}
        statusChip={certChip ? (
          <button type="button" className={`min-h-11 rounded-full border px-3 text-fluid-2xs font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${certChip.className}`} onClick={() => setCertBrandId(certChip.id)}>
            {certChip.label}
          </button>
        ) : null}
      />
      <ReceiptWalletRefresh tick={walletTick} />
      <ReceiptSummaryCards {...summary} onFailed={() => patch({ state: 'nts5', page: '1' })} onIssueFailed={() => patch({ state: 'failed', page: '1' })} />
      {!needsLink && bandBrand ? (
        <TaxInvoiceCertBand expireDate={soonestExpire} onRegister={() => setCertBrandId(bandBrand.id)} />
      ) : null}
      {needsLink ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>계산서 연결을 먼저 해주세요.</p>
          <Link to="/admin/team-leaders/cashbill" className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">계산서 연결로 가기</Link>
        </div>
      ) : null}
      {certMissing && !needsLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
          공동인증서를 등록해야 세금계산서를 발행할 수 있습니다
          <button type="button" className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => missingCert && setCertBrandId(missingCert.id)}>공동인증서 등록</button>
        </div>
      ) : null}
      {!needsLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
          <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 p-0.5">
            {([['today', '당일'], ['week', '이번주'], ['month', '월별'], ['day', '날짜']] as const).map(([id, label]) => (
              <button key={id} type="button" className={`${SEG} ${datePreset === id ? SEG_ON : 'text-slate-700'}`} onClick={() => patch({ datePreset: id, page: '1' })}>{label}</button>
            ))}
          </div>
          {datePreset === 'month' ? <YearMonthSelect value={monthKey} onChange={(month) => patch({ month, page: '1' })} /> : null}
          {datePreset === 'day' ? <YmdSelect value={dayKey} onChange={(day) => patch({ day, page: '1' })} /> : null}
          <select value={state} aria-label="상태" className="min-h-9 rounded-lg border border-slate-300 px-2 text-fluid-xs" onChange={(e) => patch({ state: e.target.value, page: '1' })}>
            {STATES.map(([id, label]) => <option key={id || 'all'} value={id}>{label}</option>)}
          </select>
          <select value={brandId} aria-label="브랜드" className="min-h-9 rounded-lg border border-slate-300 px-2 text-fluid-xs" onChange={(e) => patch({ brandId: e.target.value, page: '1' })}>
            <option value="">전체 브랜드</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
          <input
            defaultValue={queryText}
            placeholder="고객명·번호"
            aria-label="고객명·번호"
            className="min-h-9 min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-2 text-fluid-xs"
            onKeyDown={(event) => {
              if (event.key === 'Enter') patch({ q: (event.target as HTMLInputElement).value.trim(), page: '1' });
            }}
          />
        </div>
      ) : null}
      {!needsLink ? <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} /> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
      {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!needsLink && !blocking ? (
        <>
          <div className="space-y-1.5 lg:hidden">
            {mobileGroups(slots).map((group) => (
              <div key={group[0].row.id} className={group.length > 1 ? 'space-y-1.5 border-l border-slate-300 pl-2' : 'space-y-1.5'}>
                {group.map((slot) => (
                  <TaxCard key={slot.row.id} row={slot.row} nested={slot.nested} cancelling={cancellingId === slot.row.id} onCancel={() => void cancelRow(slot.row.id)} onReissue={() => navigate(`/admin/inquiries/receipts/taxinvoice/new?from=${encodeURIComponent(slot.row.id)}`)} onLink={() => setLinkIssueId(slot.row.id)} onModify={() => setModifyRow(slot.row)} onError={(message) => showReceiptFailure('처리하지 못했어요', message)} onFocusOriginal={focusOriginal} highlight={highlightId === slot.row.id} />
                ))}
              </div>
            ))}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-xs">
              <thead className="bg-slate-100">
                <tr>
                  {TAX_COLS.map((col) => (
                    <th key={col.key} className={`whitespace-nowrap px-2 py-2 text-center font-medium text-slate-700 ${col.width ?? ''} ${col.hide ?? ''}`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const row = slot.row;
                  const cell = 'h-[52px] max-h-[52px] overflow-hidden px-2 py-0 align-middle';
                  return (
                  <tr key={row.id} data-tax-row={row.id} className={`h-[52px] border-t border-slate-100 ${highlightId === row.id ? 'bg-amber-50' : ''}`}>
                    <td className={`relative whitespace-nowrap text-center tabular-nums ${cell} ${slot.nested ? 'pl-4' : ''}`}>
                      <ConnectRail connect={slot.connect} />
                      {formatReceiptIssuedAt(row.createdAt)}
                    </td>
                    <td className={`text-center ${cell}`}>
                      <p className="truncate" title={row.customerName}>{row.customerName}</p>
                      {row.inquiryNumber ? <Link className="text-fluid-2xs text-slate-600 underline hover:text-slate-900" to={`/admin/inquiries?q=${encodeURIComponent(row.inquiryNumber)}`}>{row.inquiryNumber}</Link> : null}
                    </td>
                    <td className={`truncate text-center ${cell}`} title={row.buyerCorpName}>{row.buyerCorpName}</td>
                    <td className={`text-center tabular-nums ${cell}`}>{row.buyerCorpNum || '—'}</td>
                    <td className={`text-center ${cell} ${NARROW_HIDE}`}><TaxKindBadge kind={row.taxKind} /></td>
                    <td className={`truncate text-center ${cell} ${NARROW_HIDE}`} title={row.itemName || '청소 서비스'}>{row.itemName || '청소 서비스'}</td>
                    <td className={`whitespace-nowrap text-right tabular-nums ${cell} ${signedWonTextClass(row.totalAmount)}`}>{formatSignedWon(row.totalAmount)}</td>
                    <td className={`text-center ${cell} ${NARROW_HIDE}`}>{row.purposeType === 2 ? '청구' : '영수'}</td>
                    <td className="h-[52px] px-2 py-0 text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                        <TaxStatus row={row} />
                        <OriginalLink row={row} onFocus={focusOriginal} />
                      </div>
                    </td>
                    <td className={`text-center ${cell} ${XL_HIDE}`}><ApprovalNumberCell value={row.ntsSendKey} /></td>
                    <td className={`truncate text-center text-slate-600 ${cell}`} title={row.issuerName ?? ''}>{row.issuerName || '—'}</td>
                    <td className="h-[52px] px-2 py-0 text-right align-middle"><RowAction compact row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onReissue={() => navigate(`/admin/inquiries/receipts/taxinvoice/new?from=${encodeURIComponent(row.id)}`)} onLink={() => setLinkIssueId(row.id)} onModify={() => setModifyRow(row)} onError={(message) => showReceiptFailure('처리하지 못했어요', message)} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 ? <p className="p-6 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
          </div>
          <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
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
          onIssue={() => navigate('/admin/inquiries/receipts/taxinvoice/new')}
        />
      ) : null}
    </div>
    </ReceiptWalletProvider>
  );
}

function taxFailed(row: TaxInvoiceRow): boolean {
  return !row.barobillState && Boolean(row.lastError);
}

function TaxKindBadge({ kind }: { kind?: TaxInvoiceRow['taxKind'] }) {
  const label = kind === 'zero' ? '영세' : kind === 'exempt' ? '면세' : '과세';
  return <span className="mr-1 inline-flex rounded-full bg-gray-100 px-1.5 py-0 text-fluid-2xs font-medium text-gray-700">{label}</span>;
}

function TaxStatus({ row }: { row: TaxInvoiceRow }) {
  const { openCharge } = useReceiptWallet();
  const view = taxStatusView(row);
  if (taxFailed(row)) return <FailReasonChip label={view.label} reason={row.lastError} onCharge={openCharge} />;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-1.5 py-0 text-fluid-2xs ${view.className}`}>{view.label}</span>;
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
    <article data-tax-row={row.id} className={`space-y-1 rounded-lg border border-slate-200 p-2 ${nested ? 'ml-2' : ''} ${highlight ? 'bg-amber-50' : 'bg-white'}`}>
      <p className="text-fluid-2xs tabular-nums text-slate-500">{formatReceiptIssuedAt(row.createdAt)}{row.issuerName ? ` · 발급 ${row.issuerName}` : ''}</p>
      <p className="truncate text-fluid-sm font-medium text-slate-900" title={row.customerName}>{row.customerName}</p>
      <p className="truncate text-fluid-xs text-slate-700" title={row.buyerCorpName}>{row.buyerCorpName} · {row.buyerCorpNum || '—'}</p>
      <p className={`text-right text-fluid-sm font-semibold tabular-nums ${signedWonTextClass(row.totalAmount) || 'text-slate-900'}`}>{formatSignedWon(row.totalAmount)}</p>
      <p className="truncate text-fluid-2xs text-slate-600"><TaxKindBadge kind={row.taxKind} /> {row.itemName || '청소 서비스'} · {row.purposeType === 2 ? '청구' : '영수'} · <TaxStatus row={row} /></p>
      <OriginalLink row={row} onFocus={onFocusOriginal} />
      <RowAction row={row} cancelling={cancelling} onCancel={onCancel} onReissue={onReissue} onLink={onLink} onModify={onModify} onError={onError} />
    </article>
  );
}
