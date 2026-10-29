import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API } from '../../api/apiPrefix';
import { getToken } from '../../stores/auth';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { TaxInvoiceIssueForm } from '../../components/taxinvoice/TaxInvoiceIssueForm';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ReceiptListHeader, ReceiptSummaryCards } from '../../components/receipts/ReceiptListHeader';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ReceiptWalletProvider, ReceiptWalletRefresh } from '../../components/wallet/ReceiptWalletProvider';
import {
  cancelTaxInvoice,
  listTaxInvoices,
  taxBarobillStateLabel,
  taxNtsStateLabel,
  type TaxInvoiceBrand,
  type TaxInvoiceRow,
} from '../../api/taxInvoices';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';

const SEG = 'rounded-md px-2 py-1 text-fluid-2xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const SEG_ON = 'bg-slate-900 text-white hover:bg-slate-800';
const STATES = [
  ['', '전체 상태'],
  ['3014', '발급완료'],
  ['5031', '발급취소'],
  ['nts1', '전송전'],
  ['nts23', '전송중'],
  ['nts4', '성공'],
  ['nts5', '실패'],
  ['failed', '발행 실패'],
] as const;

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}
function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}
function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function AdminTaxInvoiceListPage() {
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
  const [summary, setSummary] = useState({ issuedCount: 0, issuedWon: 0, waitingCount: 0, failedCount: 0, costWon: 0 });
  const [toastId, setToastId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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

  async function cancelRow(issueId: string) {
    setCancellingId(issueId);
    setError(null);
    try {
      await cancelTaxInvoice(issueId);
      setWalletTick((n) => n + 1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '세금계산서 취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  const blocking = shouldShowListBlockingLoading(loading, items.length);
  const selected = brands.find((brand) => brand.id === brandId);
  const needsLink = !loading && (brands.length === 0 || (selected ? !selected.linked : brands.every((brand) => !brand.linked)));
  const certMissing = !loading && brands.length > 0 && !brands.some((brand) => brand.linked && brand.certValid && !brand.simplified);

  return (
    <ReceiptWalletProvider>
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <ReceiptListHeader title="세금계산서" path="/admin/inquiries/receipts/taxinvoice" issueLabel="+ 세금계산서 발행" issueDisabled={needsLink || certMissing} onIssue={() => setIssueOpen(true)} />
      <ReceiptWalletRefresh tick={walletTick} />
      <ReceiptSummaryCards {...summary} onFailed={() => patch({ state: 'failed', page: '1' })} />
      {needsLink ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>계산서 연결을 먼저 해주세요.</p>
          <Link to="/admin/team-leaders/cashbill" className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">계산서 연결로 가기</Link>
        </div>
      ) : null}
      {certMissing && !needsLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
          공동인증서를 등록해야 세금계산서를 발행할 수 있습니다
          <Link to="/admin/team-leaders/cashbill" className="inline-flex min-h-9 items-center rounded-lg bg-slate-900 px-2 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">등록하기</Link>
        </div>
      ) : null}
      {!needsLink && issueOpen ? (
        <TaxInvoiceIssueForm
          brands={brands}
          onClose={() => setIssueOpen(false)}
          onDone={(issueId) => {
            setIssueOpen(false);
            setHighlightId(issueId);
            setToastId(issueId);
            setReload((n) => n + 1);
            window.setTimeout(() => setHighlightId(null), 4000);
          }}
        />
      ) : null}
      {toastId ? (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-900">
          발행했습니다
          <ReceiptCopyButtons kind="taxinvoice" issueId={toastId} official publicToken={null} copyReady={false} shareOnly />
        </p>
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
            {items.map((row) => <TaxCard key={row.id} row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onReissue={() => setIssueOpen(true)} highlight={highlightId === row.id} />)}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-xs">
              <thead className="bg-slate-100">
                <tr>
                  {['발급일시', '고객', '품목', '금액', '용도', '상태', '승인번호', ''].map((label) => (
                    <th key={label || 'act'} className="px-2 py-2 text-center font-medium text-slate-700">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={`border-t border-slate-100 ${highlightId === row.id ? 'bg-emerald-50' : ''}`}>
                    <td className="px-2 py-2 text-center tabular-nums">{issuedAtLabel(row.createdAt)}</td>
                    <td className="px-2 py-2 text-center">
                      <p className="truncate" title={row.buyerCorpName}>{row.buyerCorpName}</p>
                      {row.inquiryNumber ? <Link className="text-fluid-2xs text-slate-600 underline hover:text-slate-900" to={`/admin/inquiries?q=${encodeURIComponent(row.inquiryNumber)}`}>{row.inquiryNumber}</Link> : null}
                      {row.lastError ? <p className="truncate text-fluid-2xs text-red-700" title={row.lastError}>실패 이유: {row.lastError}</p> : null}
                    </td>
                    <td className="truncate px-2 py-2 text-center">{row.itemName || '청소 서비스'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{won(row.totalAmount)}</td>
                    <td className="px-2 py-2 text-center">{row.purposeType === 2 ? '청구' : '영수'}</td>
                    <td className="px-2 py-2 text-center"><TaxStatus row={row} /></td>
                    <td className="max-w-[6rem] truncate px-2 py-2 text-center tabular-nums" title={row.ntsSendKey || ''}>{row.ntsSendKey || '—'}</td>
                    <td className="px-2 py-2 text-center"><RowAction row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onReissue={() => setIssueOpen(true)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? <p className="p-6 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
          </div>
          <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
        </>
      ) : null}
    </div>
    </ReceiptWalletProvider>
  );
}

function issuedAtLabel(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '').slice(0, 11);
}

function taxFailed(row: TaxInvoiceRow): boolean {
  return row.ntsSendState === '5' || (!row.barobillState && Boolean(row.lastError));
}

function TaxStatus({ row }: { row: TaxInvoiceRow }) {
  const label = row.barobillState === '5031' ? '취소' : taxFailed(row) ? '실패' : taxNtsStateLabel(row.ntsSendState) || taxBarobillStateLabel(row.barobillState);
  const tone = row.barobillState === '5031'
    ? 'bg-slate-100 text-slate-500 line-through'
    : taxFailed(row)
      ? 'bg-red-50 text-red-800'
      : row.ntsSendState === '4' || row.barobillState === '3014'
        ? 'bg-emerald-50 text-emerald-800'
        : row.ntsSendState === '2' || row.ntsSendState === '3' || row.ntsSendState === '1'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-amber-50 text-amber-900';
  return <span className={`inline-flex rounded-full px-1.5 py-0 text-fluid-2xs ${tone}`}>{label}</span>;
}

function RowAction({ row, cancelling, onCancel, onReissue }: { row: TaxInvoiceRow; cancelling: boolean; onCancel: () => void; onReissue: () => void }) {
  const btn = 'min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const official = row.barobillState === '3014' || row.barobillState === '5031';
  return (
    <div className="inline-flex items-center justify-center gap-1">
      {taxFailed(row) ? (
        <button type="button" className={btn} onClick={onReissue}>다시 발행</button>
      ) : (
        <button type="button" className={btn} disabled={!official} onClick={() => void openTaxMail(row.id)}>영수증</button>
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
      />
    </div>
  );
}

async function openTaxMail(issueId: string): Promise<void> {
  const res = await fetch(`${API}/tax-invoices/${issueId}/mail-url`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) return;
  const body = (await res.json()) as { url?: string };
  if (body.url) window.open(body.url, 'cbiseoTaxReceipt', 'popup,width=480,height=720');
}

function TaxCard({ row, cancelling, onCancel, onReissue, highlight }: { row: TaxInvoiceRow; cancelling: boolean; onCancel: () => void; onReissue: () => void; highlight: boolean }) {
  return (
    <article className={`space-y-1 rounded-lg border border-slate-200 p-2 ${highlight ? 'bg-emerald-50' : 'bg-white'}`}>
      <p className="truncate text-fluid-sm font-medium text-slate-900">{row.buyerCorpName}</p>
      <p className="text-right text-fluid-sm font-semibold tabular-nums text-slate-900">{won(row.totalAmount)}</p>
      <p className="truncate text-fluid-2xs text-slate-600">{row.itemName || '청소 서비스'} · {row.purposeType === 2 ? '청구' : '영수'} · <TaxStatus row={row} /></p>
      {row.lastError ? <p className="truncate text-fluid-2xs text-red-700">실패 이유: {row.lastError}</p> : null}
      <RowAction row={row} cancelling={cancelling} onCancel={onCancel} onReissue={onReissue} />
    </article>
  );
}
