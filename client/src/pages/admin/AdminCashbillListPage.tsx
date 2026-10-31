import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  cancelCashbillIssue,
  cashbillStateLabel,
  fetchCashbillSource,
  linkCashbillInquiry,
  listCashbillIssues,
  openCashbillReceipt,
  type CashbillIssueRow,
} from '../../api/cashbillIssues';
import { CashbillIssueForm, type CashbillIssueSeed } from '../../components/cashbill/CashbillIssueForm';
import { ReceiptInquiryLinkModal } from '../../components/receipts/ReceiptInquiryLinkModal';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ReceiptListHeader, ReceiptSummaryCards } from '../../components/receipts/ReceiptListHeader';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ReceiptWalletProvider, ReceiptWalletRefresh } from '../../components/wallet/ReceiptWalletProvider';
import { clampListPage, parseInquiryListPageSize, parseListPage } from '../../utils/listPagination';
import { formatSignedWon, signedWonTextClass } from '../../utils/signedWon';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { Button } from '../../components/ui/Button';
import { FailReasonChip, showReceiptDone, showReceiptFailure } from '../../components/receipts/receiptToasts';
import { useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';
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

const STATES = [
  ['', '전체 상태'],
  ['2000', '발급 완료 · 국세청 전송 대기'],
  ['2500', '국세청 전송 대기'],
  ['3000', '국세청 전송 완료'],
  ['4000', '전송 실패'],
  ['7000', '발급 취소'],
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
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSeed, setIssueSeed] = useState<CashbillIssueSeed | null>(null);
  const fromId = searchParams.get('from') || '';
  const [reload, setReload] = useState(0);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [linkIssueId, setLinkIssueId] = useState<string | null>(null);
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
    if (!fromId) return;
    let stop = false;
    fetchCashbillSource(fromId)
      .then((src) => {
        if (stop) return;
        setIssueSeed({
          brandId: src.operatingCompanyId,
          amount: String(src.amount),
          usage: src.usage,
          itemName: src.itemName,
          memo: src.memo,
          askIdentity: true,
          customerName: src.customerName ?? '',
        });
        setIssueOpen(true);
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '다시 발행할 내용을 불러오지 못했습니다.');
      });
    return () => { stop = true; };
  }, [fromId]);

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
      showReceiptDone('발급을 취소했어요', '국세청에 취소분이 함께 전송됩니다.');
    } catch (err) {
      showReceiptFailure('발급을 취소하지 못했어요', err instanceof Error ? err.message : '현금영수증 취소에 실패했습니다.');
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
      <ReceiptListHeader title="현금영수증" path="/admin/inquiries/receipts/cashbill" issueLabel="+ 현금영수증 발행" issueDisabled={needsLink} onIssue={() => { setIssueSeed(null); patch({ from: null }); setIssueOpen(true); }} />
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
          key={fromId || 'new'}
          brands={brands}
          seed={issueSeed}
          onClose={() => { setIssueOpen(false); patch({ from: null }); }}
          onDone={(issueId) => {
            setIssueOpen(false);
            setHighlightId(issueId);
            showReceiptDone(
              '현금영수증을 발행했어요',
              '목록 맨 위에 표시해 두었어요.',
              <>
                <Button size="sm" variant="primary" onClick={() => void openCashbillReceipt(issueId).catch((err: unknown) => showReceiptFailure('영수증을 열지 못했어요', err instanceof Error ? err.message : null))}>영수증 보기</Button>
                <ReceiptCopyButtons kind="cashbill" issueId={issueId} official publicToken={null} copyReady={false} shareOnly />
              </>,
            );
            setReload((n) => n + 1);
            window.setTimeout(() => setHighlightId(null), 4000);
          }}
        />
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
          placeholder="고객명·발급번호·접수번호"
          aria-label="고객명·발급번호·접수번호"
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
            {items.map((row) => <CashbillCard key={row.id} row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onError={(message) => showReceiptFailure('처리하지 못했어요', message)} onReissue={() => patch({ from: row.id })} onLink={() => setLinkIssueId(row.id)} highlight={highlightId === row.id} />)}
            {items.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-fluid-sm text-slate-500">발급 내역이 없습니다.</p> : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-xs">
              <thead className="bg-slate-100">
                <tr>
                  {CASH_COLS.map((col) => (
                    <th key={col.key} style={col.width ? { width: col.width } : undefined} className={`whitespace-nowrap px-2 py-2 font-medium text-slate-700 ${col.align} ${col.hide}`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={`h-[52px] border-t border-slate-100 ${highlightId === row.id ? 'bg-emerald-50' : ''}`}>
                    <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums text-slate-600">{formatReceiptIssuedAt(row.createdAt)}</td>
                    <td className="px-2 py-2 text-left">
                      <CustomerNameCell row={row} />
                    </td>
                    <td className="px-2 py-2 text-left">
                      <p className="truncate tabular-nums text-slate-900" title={identityText(row)}>{identityText(row)}</p>
                      <p className="text-fluid-2xs text-slate-500">{usageLabel(row)}</p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <InquiryCell row={row} onLink={() => setLinkIssueId(row.id)} />
                    </td>
                    <td className={`truncate px-2 py-2 text-left ${NARROW_HIDE}`} title={row.itemName}>{row.itemName}</td>
                    <td className={`whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums ${signedWonTextClass(row.totalWon)}`}>{formatSignedWon(row.totalWon)}</td>
                    <td className="px-2 py-2 text-center"><StatusBadge row={row} /></td>
                    <td className={`truncate px-2 py-2 text-center tabular-nums text-slate-600 ${XL_HIDE}`} title={row.ntsConfirmNum ?? ''}>{row.ntsConfirmNum || '—'}</td>
                    <td className="truncate px-2 py-2 text-center text-slate-600" title={row.issuerName ?? ''}>{row.issuerName || '—'}</td>
                    <td className="px-2 py-2 text-right">
                      <ReceiptActions compact row={row} cancelling={cancellingId === row.id} onCancel={() => void cancelRow(row.id)} onError={(message) => showReceiptFailure('처리하지 못했어요', message)} onReissue={() => patch({ from: row.id })} onLink={() => setLinkIssueId(row.id)} />
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
    </ReceiptWalletProvider>
  );
}

function usageLabel(row: CashbillIssueRow): string {
  if (row.kind === 'CANCEL') return '취소';
  if (row.tradeUsage === 2) return '지출증빙';
  if (row.identityMasked === '자진발급') return '자진발급';
  return '소득공제';
}

const NARROW_HIDE = 'hidden min-[1440px]:table-cell';
const XL_HIDE = 'hidden xl:table-cell';

/** 고객명·품목은 남는 폭을 나눠 쓰고, 좁은 화면에서는 품목→승인번호 순으로 숨긴다. */
const CASH_COLS = [
  { key: 'at', label: '발급일시', width: '96px', align: 'text-center', hide: '' },
  { key: 'name', label: '고객명', width: undefined, align: 'text-left', hide: '' },
  { key: 'id', label: '발급번호', width: '140px', align: 'text-left', hide: '' },
  { key: 'inq', label: '접수', width: '112px', align: 'text-center', hide: '' },
  { key: 'item', label: '품목', width: undefined, align: 'text-left', hide: NARROW_HIDE },
  { key: 'won', label: '금액', width: '100px', align: 'text-right', hide: '' },
  { key: 'st', label: '상태', width: '190px', align: 'text-center', hide: '' },
  { key: 'nts', label: '승인번호', width: '108px', align: 'text-center', hide: XL_HIDE },
  { key: 'by', label: '발급자', width: '84px', align: 'text-center', hide: '' },
  { key: 'act', label: '', width: '120px', align: 'text-right', hide: '' },
] as const;

/** 고객명: 접수 이름 → 발급 때 적은 이름 → 「연계 없음」 */
function customerNameOf(row: CashbillIssueRow): string | null {
  const name = row.customerName?.trim() ?? '';
  return name && name !== '매칭 없음' ? name : null;
}

function identityText(row: CashbillIssueRow): string {
  if (row.identityMasked === '자진발급') return '010-000-1234';
  const text = row.tradeUsage === 2 ? displayReceiptBiz(row.identityMasked) : displayReceiptPhone(row.identityMasked);
  return text && text !== '—' ? text : '—';
}

function CustomerNameCell({ row }: { row: CashbillIssueRow }) {
  const name = customerNameOf(row);
  return (
    <div className="min-w-0">
      {name ? (
        <p className="truncate font-semibold text-slate-900" title={name}>{name}</p>
      ) : (
        <p className="truncate text-slate-400">연계 없음</p>
      )}
      {name && !row.linked ? (
        <p className="text-fluid-2xs text-slate-500">직접 입력</p>
      ) : null}
    </div>
  );
}

function InquiryCell({ row, onLink, size = 'sm' }: { row: CashbillIssueRow; onLink: () => void; size?: 'sm' | 'md' }) {
  if (row.inquiryNumber) {
    return (
      <Link className="whitespace-nowrap tabular-nums text-[#1f4fb8] underline-offset-2 hover:underline" to={`/admin/inquiries?q=${encodeURIComponent(row.inquiryNumber)}`} title="접수 보기">
        {row.inquiryNumber}
      </Link>
    );
  }
  if (row.kind === 'CANCEL') return <span className="text-slate-400">—</span>;
  return <Button size={size} variant="secondary" onClick={onLink}>접수 연결</Button>;
}

function isFailedRow(row: CashbillIssueRow): boolean {
  return row.barobillState === '4000' || (!row.barobillState && Boolean(row.lastError));
}

function canViewReceipt(row: CashbillIssueRow): boolean {
  return row.barobillState === '2000' || row.barobillState === '2500' || row.barobillState === '3000' || row.barobillState === '7000';
}

function StatusBadge({ row }: { row: CashbillIssueRow }) {
  const { openCharge } = useReceiptWallet();
  const label = cashbillStateLabel(row.barobillState, row.lastError);
  if (isFailedRow(row) && row.kind !== 'CANCEL') return <FailReasonChip label={label} reason={row.lastError} onCharge={openCharge} />;
  const tone = row.barobillState === '7000' || row.kind === 'CANCEL'
    ? 'border border-slate-200 bg-slate-100 text-slate-500'
    : isFailedRow(row)
      ? 'border border-[#f3b8b1] bg-[#fdecea] text-[#b42318]'
      : row.barobillState === '3000'
        ? 'border border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]'
        : row.barobillState === '2000' || row.barobillState === '2500'
          ? 'border border-[#b9cdf7] bg-[#e8f0ff] text-[#1f4fb8]'
          : 'border border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-1.5 py-0 text-fluid-2xs ${tone}`}>{label}</span>;
}

function ReceiptActions({
  row,
  cancelling,
  onCancel,
  onError,
  onReissue,
  onLink,
  compact = false,
}: {
  row: CashbillIssueRow;
  cancelling: boolean;
  onCancel: () => void;
  onError: (message: string) => void;
  onReissue: () => void;
  onLink: () => void;
  compact?: boolean;
}) {
  const size = compact ? 'sm' : 'md';
  const failed = isFailedRow(row) || row.barobillState === '7000' || row.kind === 'CANCEL';
  return (
    <div className="inline-flex items-center justify-end gap-1">
      {failed ? (
        <Button size={size} onClick={onReissue}>다시 발행</Button>
      ) : (
        <Button size={size} disabled={!canViewReceipt(row)} onClick={() => void openCashbillReceipt(row.id).catch((err: unknown) => onError(err instanceof Error ? err.message : '영수증을 열지 못했습니다.'))}>
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
        compact={compact}
      />
    </div>
  );
}

function CashbillCard({ row, cancelling, onCancel, onError, onReissue, onLink, highlight }: { row: CashbillIssueRow; cancelling: boolean; onCancel: () => void; onError: (message: string) => void; onReissue: () => void; onLink: () => void; highlight: boolean }) {
  const name = customerNameOf(row);
  return (
    <article className={`space-y-1.5 rounded-xl border border-slate-200 p-3 ${highlight ? 'bg-emerald-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {name ? <p className="truncate text-fluid-sm font-semibold text-slate-900">{name}</p> : <p className="text-fluid-sm text-slate-400">연계 없음</p>}
          <p className="truncate text-fluid-2xs tabular-nums text-slate-500">{identityText(row)} · {usageLabel(row)}{name && !row.linked ? ' · 직접 입력' : ''}</p>
        </div>
        <p className={`shrink-0 text-fluid-sm font-semibold tabular-nums ${signedWonTextClass(row.totalWon) || 'text-slate-900'}`}>{formatSignedWon(row.totalWon)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-fluid-2xs text-slate-500">
        <span className="tabular-nums">{formatReceiptIssuedAt(row.createdAt)}</span>
        <span className="truncate">{row.itemName}</span>
        {row.issuerName ? <span className="truncate">발급 {row.issuerName}</span> : null}
        <StatusBadge row={row} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        {row.inquiryNumber ? (
          <p className="min-w-0 truncate text-fluid-xs text-slate-500">접수 <InquiryCell row={row} onLink={onLink} /></p>
        ) : row.kind === 'CANCEL' ? <span /> : <InquiryCell row={row} onLink={onLink} size="md" />}
        <ReceiptActions row={row} cancelling={cancelling} onCancel={onCancel} onError={onError} onReissue={onReissue} onLink={onLink} />
      </div>
    </article>
  );
}
