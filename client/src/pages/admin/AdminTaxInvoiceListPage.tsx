import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { TaxInvoiceIssueForm } from '../../components/taxinvoice/TaxInvoiceIssueForm';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ReceiptWalletCard } from '../../components/wallet/ReceiptWalletCard';
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
  const datePreset = searchParams.get('datePreset') || 'all';
  const monthKey = searchParams.get('month') || kstMonthKeyNow();
  const dayKey = searchParams.get('day') || kstYmdNow();
  const state = searchParams.get('state') || '';
  const brandId = searchParams.get('brandId') || '';
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));
  const [items, setItems] = useState<TaxInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<TaxInvoiceBrand[]>([]);
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
    qs.set('limit', String(pageSize));
    qs.set('offset', String((safePage - 1) * pageSize));
    const res = await listTaxInvoices(qs);
    setItems(res.items);
    setTotal(res.total);
    setBrands(res.brands);
  }, [datePreset, monthKey, dayKey, state, brandId, pageSize, safePage]);

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

  return (
    <ReceiptWalletProvider>
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <PageTitleWithFavorite label="세금계산서" path="/admin/inquiries/receipts/taxinvoice">
        <h1 className="text-fluid-lg font-semibold text-slate-900">세금계산서</h1>
      </PageTitleWithFavorite>
      <ReceiptWalletCard />
      <ReceiptWalletRefresh tick={walletTick} />
      {needsLink ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>계산서 연결을 먼저 해주세요.</p>
          <Link to="/admin/team-leaders/cashbill" className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">계산서 연결로 가기</Link>
        </div>
      ) : null}
      {!needsLink ? (
        <button type="button" className="min-h-10 w-fit rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" onClick={() => setIssueOpen((open) => !open)}>
          세금계산서 발행
        </button>
      ) : null}
      {!needsLink && issueOpen ? <TaxInvoiceIssueForm brands={brands} onDone={() => { setIssueOpen(false); setReload((n) => n + 1); }} /> : null}
      {!needsLink ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
          <span className="text-fluid-xs text-slate-600">발행일</span>
          <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 p-0.5">
            {([['today', '당일'], ['all', '전체'], ['month', '월별'], ['day', '날짜']] as const).map(([id, label]) => (
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
        </div>
      ) : null}
      {!needsLink ? <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} /> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
      {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!needsLink && !blocking ? (
        <>
          <div className="space-y-1.5 lg:hidden">
            {items.map((row) => <TaxCard key={row.id} row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} />)}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발행 내역이 없습니다.</p> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-xs">
              <colgroup>
                <col className="w-[18%]" /><col className="w-[16%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[14%]" />
              </colgroup>
              <thead className="bg-slate-100">
                <tr>
                  {['공급받는자', '브랜드', '합계', '발급 상태', '국세청', '작성일', ''].map((label) => (
                    <th key={label || 'act'} className="px-2 py-2 text-center font-medium text-slate-700">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="truncate px-2 py-2 text-center" title={row.buyerCorpName}>{row.buyerCorpName}</td>
                    <td className="truncate px-2 py-2 text-center">{row.brandName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{won(row.totalAmount)}</td>
                    <td className="px-2 py-2 text-center">{taxBarobillStateLabel(row.barobillState)}</td>
                    <td className="px-2 py-2 text-center">{taxNtsStateLabel(row.ntsSendState)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.writeDate}</td>
                    <td className="px-2 py-2 text-center"><RowAction row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} /></td>
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

function RowAction({ row, cancelling, onCancel }: { row: TaxInvoiceRow; cancelling: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <ReceiptCopyButtons
        kind="taxinvoice"
        issueId={row.id}
        official={row.barobillState === '3014' || row.barobillState === '5031'}
        publicToken={row.publicToken ?? null}
        copyReady={Boolean(row.copyReady)}
      />
      {row.canCancel ? (
        <button type="button" className="min-h-9 rounded-lg border border-slate-300 px-2 text-fluid-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none" disabled={cancelling} onClick={onCancel}>
          {cancelling ? '취소 중…' : '발급취소'}
        </button>
      ) : row.modifyLater ? (
        <span className="text-fluid-2xs text-slate-500">수정세금계산서는 추후 지원</span>
      ) : row.lastError ? (
        <span className="text-fluid-2xs text-slate-400">실패</span>
      ) : null}
    </div>
  );
}

function TaxCard({ row, cancelling, onCancel }: { row: TaxInvoiceRow; cancelling: boolean; onCancel: () => void }) {
  return (
    <article className="space-y-1 rounded-lg border border-slate-200 bg-white p-2">
      <p className="truncate text-fluid-sm font-medium text-slate-900">{row.buyerCorpName}</p>
      <p className="text-right text-fluid-xs tabular-nums text-slate-800">{won(row.totalAmount)}</p>
      <p className="truncate text-fluid-2xs text-slate-600">{row.brandName} · {taxBarobillStateLabel(row.barobillState)} · {taxNtsStateLabel(row.ntsSendState)}</p>
      <RowAction row={row} cancelling={cancelling} onCancel={onCancel} />
    </article>
  );
}
