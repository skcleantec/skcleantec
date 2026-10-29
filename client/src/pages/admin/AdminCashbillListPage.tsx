import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  cancelCashbillIssue,
  cashbillStateLabel,
  listCashbillIssues,
  openCashbillReceipt,
  type CashbillIssueRow,
} from '../../api/cashbillIssues';
import { CashbillIssueForm } from '../../components/cashbill/CashbillIssueForm';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ReceiptListHeader, ReceiptSummaryCards } from '../../components/receipts/ReceiptListHeader';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ReceiptWalletProvider, ReceiptWalletRefresh } from '../../components/wallet/ReceiptWalletProvider';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { displayReceiptBiz, displayReceiptPhone, formatReceiptIssuedAt } from '../../components/receipts/receiptListDisplay';

const SEG =
  'rounded-md px-2 py-1 text-fluid-2xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const SEG_ON = 'bg-slate-900 text-white hover:bg-slate-800';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}
function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}
function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

const STATES = [
  ['', '전체 상태'],
  ['2000', '발급완료'],
  ['2500', '국세청 전송중'],
  ['3000', '국세청 전송완료'],
  ['4000', '국세청 전송실패'],
  ['7000', '취소완료'],
  ['failed', '실패'],
] as const;

export function AdminCashbillListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datePreset = searchParams.get('datePreset') || 'today';
  const monthKey = searchParams.get('month') || kstMonthKeyNow();
  const dayKey = searchParams.get('day') || kstYmdNow();
  const state = searchParams.get('state') || '';
  const brandId = searchParams.get('brandId') || '';
  const queryText = searchParams.get('q') || '';
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));
  const [items, setItems] = useState<CashbillIssueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<{ id: string; name: string; linked: boolean }[]>([]);
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

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('datePreset', datePreset);
    if (datePreset === 'month') qs.set('month', monthKey);
    if (datePreset === 'day') qs.set('day', dayKey);
    if (state) qs.set('state', state);
    if (brandId) qs.set('brandId', brandId);
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
        setBrands(res.brands);
        if (res.summary) setSummary(res.summary);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datePreset, monthKey, dayKey, state, brandId, queryText, pageSize, safePage, reload]);

  async function cancelRow(issueId: string) {
    setCancellingId(issueId);
    setError(null);
    try {
      await cancelCashbillIssue(issueId, crypto.randomUUID());
      setWalletTick((n) => n + 1);
      const qs = new URLSearchParams();
      qs.set('datePreset', datePreset);
      if (datePreset === 'month') qs.set('month', monthKey);
      if (datePreset === 'day') qs.set('day', dayKey);
      if (state) qs.set('state', state);
      if (brandId) qs.set('brandId', brandId);
      qs.set('limit', String(pageSize));
      qs.set('offset', String((safePage - 1) * pageSize));
      const res = await listCashbillIssues(qs);
      setItems(res.items);
      setTotal(res.total);
      setBrands(res.brands);
    } catch (err) {
      setError(err instanceof Error ? err.message : '현금영수증 취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  const blocking = shouldShowListBlockingLoading(loading, items.length);
  const selectedBrand = brands.find((brand) => brand.id === brandId);
  const needsLink = !loading && (brands.length === 0 || (selectedBrand ? !selectedBrand.linked : brands.every((brand) => !brand.linked)));

  return (
    <ReceiptWalletProvider>
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <ReceiptListHeader title="현금영수증" path="/admin/inquiries/receipts/cashbill" issueLabel="+ 현금영수증 발행" issueDisabled={needsLink} onIssue={() => setIssueOpen(true)} />
      <ReceiptWalletRefresh tick={walletTick} />
      <ReceiptSummaryCards {...summary} onFailed={() => patch({ state: 'failed', page: '1' })} />
      {needsLink ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>계산서 연결을 먼저 해주세요.</p>
          <Link
            to="/admin/team-leaders/cashbill"
            className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            계산서 연결로 가기
          </Link>
        </div>
      ) : null}
      {!needsLink && issueOpen ? (
        <CashbillIssueForm
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
          <button type="button" className="min-h-8 rounded-lg border border-emerald-300 bg-white px-2 text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2" onClick={() => void openCashbillReceipt(toastId).catch((err: unknown) => setError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>영수증 보기</button>
          <ReceiptCopyButtons kind="cashbill" issueId={toastId} official publicToken={null} copyReady={false} shareOnly />
        </p>
      ) : null}
      {!needsLink ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
        <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 p-0.5">
          {([['today', '당일'], ['week', '이번주'], ['month', '월별'], ['day', '날짜']] as const).map(([id, label]) => (
            <button key={id} type="button" className={`${SEG} ${datePreset === id ? SEG_ON : 'text-slate-700'}`} onClick={() => patch({ datePreset: id, page: '1' })}>
              {label}
            </button>
          ))}
        </div>
        {datePreset === 'month' ? <YearMonthSelect value={monthKey} onChange={(month) => patch({ month, page: '1' })} /> : null}
        {datePreset === 'day' ? <YmdSelect value={dayKey} onChange={(day) => patch({ day, page: '1' })} /> : null}
        <select
          value={state}
          onChange={(e) => patch({ state: e.target.value, page: '1' })}
          className="min-h-9 rounded-lg border border-slate-300 px-2 text-fluid-xs"
          aria-label="상태"
        >
          {STATES.map(([id, label]) => <option key={id || 'all'} value={id}>{label}</option>)}
        </select>
        <select
          value={brandId}
          onChange={(e) => patch({ brandId: e.target.value, page: '1' })}
          className="min-h-9 rounded-lg border border-slate-300 px-2 text-fluid-xs"
          aria-label="브랜드"
        >
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
      </div> : null}
      {!needsLink ? <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} /> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
      {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!needsLink && !blocking ? (
        <>
          <div className="space-y-2 lg:hidden">
            {items.map((row) => <CashbillCard key={row.id} row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onError={setError} onReissue={() => setIssueOpen(true)} highlight={highlightId === row.id} />)}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발급 내역이 없습니다.</p> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
            <table className="w-full border-collapse text-fluid-xs">
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
                    <td className="px-2 py-2 text-center tabular-nums">{formatReceiptIssuedAt(row.createdAt)}</td>
                    <td className="px-2 py-2 text-center">
                      <p className="truncate" title={customerLine(row)}>{customerLine(row)}</p>
                      {row.inquiryNumber ? (
                        <Link className="text-fluid-2xs text-slate-600 underline hover:text-slate-900" to={`/admin/inquiries?q=${encodeURIComponent(row.inquiryNumber)}`}>{row.inquiryNumber}</Link>
                      ) : null}
                      {row.lastError ? <p className="truncate text-fluid-2xs text-red-700" title={row.lastError}>실패 이유: {row.lastError}</p> : null}
                    </td>
                    <td className="max-w-[8rem] truncate px-2 py-2 text-center" title={row.itemName}>{row.itemName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{won(row.totalWon)}</td>
                    <td className="px-2 py-2 text-center">{usageLabel(row)}</td>
                    <td className="px-2 py-2 text-center"><StatusBadge row={row} /></td>
                    <td className="px-2 py-2 text-center tabular-nums">{row.ntsConfirmNum || '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <ReceiptActions row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onError={setError} onReissue={() => setIssueOpen(true)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {!needsLink && !loading ? (
        <ListPaginationBar mode="nav" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} />
      ) : null}
    </div>
    </ReceiptWalletProvider>
  );
}

function usageLabel(row: CashbillIssueRow): string {
  if (row.kind === 'CANCEL') return '취소';
  if (row.tradeUsage === 2) return '지출증빙';
  if (row.identityMasked === '자진발급') return '자진발급';
  return '소득공제';
}

function customerLine(row: CashbillIssueRow): string {
  if (row.identityMasked === '자진발급') return '(번호 없음·자진발급)';
  const name = row.customerName && row.customerName !== '매칭 없음' ? row.customerName : '';
  const number = row.tradeUsage === 2 ? displayReceiptBiz(row.identityMasked) : displayReceiptPhone(row.identityMasked);
  return [name, number].filter(Boolean).join(' ') || '(번호 없음)';
}

function isFailedRow(row: CashbillIssueRow): boolean {
  return row.barobillState === '4000' || (!row.barobillState && Boolean(row.lastError));
}

function canViewReceipt(row: CashbillIssueRow): boolean {
  return row.barobillState === '2000' || row.barobillState === '2500' || row.barobillState === '3000' || row.barobillState === '7000';
}

function StatusBadge({ row }: { row: CashbillIssueRow }) {
  const label = cashbillStateLabel(row.barobillState, row.lastError);
  const tone = row.barobillState === '7000' || row.kind === 'CANCEL'
    ? 'bg-slate-100 text-slate-500 line-through'
    : isFailedRow(row)
      ? 'bg-red-50 text-red-800'
      : row.barobillState === '2500'
        ? 'bg-slate-100 text-slate-700'
        : row.barobillState === '2000' || row.barobillState === '3000'
          ? 'bg-emerald-50 text-emerald-800'
          : 'bg-amber-50 text-amber-900';
  return <span className={`inline-flex rounded-full px-1.5 py-0 text-fluid-2xs ${tone}`}>{label}</span>;
}

function ReceiptActions({
  row,
  cancelling,
  onCancel,
  onError,
  onReissue,
}: {
  row: CashbillIssueRow;
  cancelling: boolean;
  onCancel: () => void;
  onError: (message: string) => void;
  onReissue: () => void;
}) {
  const btn = 'min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const failed = isFailedRow(row);
  return (
    <div className="inline-flex items-center justify-center gap-1">
      {failed ? (
        <button type="button" className={btn} onClick={onReissue}>다시 발행</button>
      ) : (
        <button type="button" className={btn} disabled={!canViewReceipt(row)} onClick={() => void openCashbillReceipt(row.id).catch((err: unknown) => onError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>
          영수증
        </button>
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
      />
    </div>
  );
}

function CashbillCard({ row, cancelling, onCancel, onError, onReissue, highlight }: { row: CashbillIssueRow; cancelling: boolean; onCancel: () => void; onError: (message: string) => void; onReissue: () => void; highlight: boolean }) {
  return (
    <article className={`rounded-lg border border-slate-200 p-2 ${highlight ? 'bg-emerald-50' : 'bg-white'}`}>
      <p className="text-fluid-2xs tabular-nums text-slate-500">{formatReceiptIssuedAt(row.createdAt)}</p>
      <p className="truncate text-fluid-sm font-medium">{customerLine(row)}</p>
      <p className="text-right text-fluid-sm font-semibold tabular-nums text-slate-900">{won(row.totalWon)}</p>
      <p className="truncate text-fluid-xs text-slate-700">{row.itemName} · {usageLabel(row)} · <StatusBadge row={row} /></p>
      {row.lastError ? <p className="truncate text-fluid-2xs text-red-700" title={row.lastError}>실패 이유: {row.lastError}</p> : null}
      <ReceiptActions row={row} cancelling={cancelling} onCancel={onCancel} onError={onError} onReissue={onReissue} />
    </article>
  );
}
