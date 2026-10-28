import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  cancelCashbillIssue,
  cashbillStateLabel,
  CASHBILL_KIND_LABEL,
  listCashbillIssues,
  openCashbillReceipt,
  type CashbillIssueRow,
  type CashbillKind,
} from '../../api/cashbillIssues';
import { CashbillIssueForm } from '../../components/cashbill/CashbillIssueForm';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';

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
  const datePreset = searchParams.get('datePreset') || 'all';
  const monthKey = searchParams.get('month') || kstMonthKeyNow();
  const dayKey = searchParams.get('day') || kstYmdNow();
  const state = searchParams.get('state') || '';
  const brandId = searchParams.get('brandId') || '';
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));
  const [items, setItems] = useState<CashbillIssueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState<{ id: string; name: string; linked: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
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
  }, [datePreset, monthKey, dayKey, state, brandId, pageSize, safePage, reload]);

  async function cancelRow(issueId: string) {
    setCancellingId(issueId);
    setError(null);
    try {
      await cancelCashbillIssue(issueId, crypto.randomUUID());
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
    <div className="flex min-w-0 w-full max-w-full flex-col gap-2 sm:gap-4">
      <PageTitleWithFavorite label="현금영수증" path="/admin/inquiries/receipts/cashbill">
        <h1 className="text-fluid-lg font-semibold text-slate-900">현금영수증</h1>
      </PageTitleWithFavorite>
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
      {!needsLink ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={() => setIssueOpen((open) => !open)}
          >
            현금영수증 발행
          </button>
        </div>
      ) : null}
      {!needsLink && issueOpen ? (
        <CashbillIssueForm brands={brands} onDone={() => { setIssueOpen(false); setReload((n) => n + 1); }} />
      ) : null}
      {!needsLink ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
        <span className="text-fluid-xs text-slate-600">발급일</span>
        <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 p-0.5">
          {([['today', '당일'], ['all', '전체'], ['month', '월별'], ['day', '날짜']] as const).map(([id, label]) => (
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
      </div> : null}
      {!needsLink ? <ListPaginationBar mode="summary" page={safePage} pageSize={pageSize} total={total} onPageChange={(next) => patch({ page: String(next) })} onPageSizeChange={(next) => patch({ pageSize: String(next), page: '1' })} /> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
      {blocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!needsLink && !blocking ? (
        <>
          <div className="space-y-2 lg:hidden">
            {items.map((row) => <CashbillCard key={row.id} row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onError={setError} />)}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발급 내역이 없습니다.</p> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
            <table className="w-full border-collapse text-fluid-xs">
              <thead className="bg-slate-100">
                <tr>
                  {['발급일', '접수', '브랜드', '구분', '금액', '상태', '국세청', ''].map((label) => (
                    <th key={label} className="px-2 py-2 text-center font-medium text-slate-700">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-center">{row.createdAt.slice(0, 10)}</td>
                    <td className="max-w-[10rem] truncate px-2 py-2 text-center" title={row.customerName}>{row.customerName} {row.inquiryNumber ?? ''}</td>
                    <td className="px-2 py-2 text-center">{row.brandName}</td>
                    <td className="px-2 py-2 text-center">{CASHBILL_KIND_LABEL[row.kind as CashbillKind]}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{won(row.totalWon)}</td>
                    <td className="px-2 py-2 text-center">{cashbillStateLabel(row.barobillState, row.lastError)}</td>
                    <td className="px-2 py-2 text-center">{row.ntsConfirmNum || '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <ReceiptActions row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onError={setError} />
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
  );
}

function canViewReceipt(row: CashbillIssueRow): boolean {
  return row.barobillState === '2000' || row.barobillState === '2500' || row.barobillState === '3000' || row.barobillState === '7000';
}

function ReceiptActions({
  row,
  cancelling,
  onCancel,
  onError,
}: {
  row: CashbillIssueRow;
  cancelling: boolean;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const btn = 'min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-fluid-2xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {canViewReceipt(row) ? (
        <button type="button" className={btn} onClick={() => void openCashbillReceipt(row.id).catch((err: unknown) => onError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>
          영수증 보기
        </button>
      ) : null}
      {row.canCancel ? (
        <button type="button" className={btn} disabled={cancelling} onClick={onCancel}>
          {cancelling ? '취소 중…' : '취소'}
        </button>
      ) : null}
    </div>
  );
}

function CashbillCard({ row, cancelling, onCancel, onError }: { row: CashbillIssueRow; cancelling: boolean; onCancel: () => void; onError: (message: string) => void }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="truncate text-fluid-sm font-medium">{row.customerName}</p>
      <p className="text-fluid-xs text-slate-700">{CASHBILL_KIND_LABEL[row.kind as CashbillKind]} {won(row.totalWon)} · {cashbillStateLabel(row.barobillState, row.lastError)}</p>
      <p className="truncate text-fluid-2xs text-slate-500">{row.brandName} · {row.inquiryNumber ?? ''} · 국세청 {row.ntsConfirmNum || '대기'}</p>
      {row.canCancel || canViewReceipt(row) ? (
        <ReceiptActions row={row} cancelling={cancelling} onCancel={onCancel} onError={onError} />
      ) : null}
    </article>
  );
}
