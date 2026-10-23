import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import {
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';
import { createPgFeeLedgerApi, type PgFeeLedger, type PgFeeLedgerItem } from '../../api/pgFeeLedger';

const PRESETS = [
  { id: 'today', label: '당일' },
  { id: 'all', label: '전체' },
  { id: 'month', label: '월별' },
  { id: 'day', label: '날짜' },
] as const;

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function percent(bps: number): string {
  return (bps / 100).toFixed(2);
}

function currentYm(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function PgFeeLedgerView({
  basePath,
  token,
  title,
}: {
  basePath: string;
  token: () => string;
  title: string;
}) {
  const api = useMemo(() => createPgFeeLedgerApi(basePath, token), [basePath, token]);
  const [params, setParams] = useSearchParams();
  const datePreset = params.get('datePreset') || 'all';
  const month = params.get('month') || currentYm();
  const day = params.get('day') || currentYmd();
  const tenantId = params.get('tenantId') || '';
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const [data, setData] = useState<PgFeeLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PgFeeLedgerItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const write = (next: Record<string, string | null>, resetPage = false) => {
    const q = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) q.delete(key);
      else q.set(key, value);
    }
    if (resetPage) q.delete('page');
    setParams(q, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .load({
        datePreset,
        month: datePreset === 'month' ? month : undefined,
        day: datePreset === 'day' ? day : undefined,
        tenantId: tenantId || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((ledger) => {
        if (!cancelled) {
          setData(ledger);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, datePreset, month, day, tenantId, page, pageSize, reloadKey]);

  const canManage = Boolean(data?.canManage);

  return (
    <div className="min-w-0 w-full max-w-full space-y-3">
      <div>
        <h1 className="text-fluid-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-fluid-xs leading-snug text-slate-600">
          서비스브릿지 {data ? percent(data.serviceBridgeBps) : '2.62'}% · 가맹점 기본{' '}
          {data ? percent(data.defaultMerchantBps) : '3.30'}%. 둘 다 부가세 포함이고, 그 차이를 서비스브릿지가 가져갑니다.
          이미 결제된 건은 결제 당시 수수료로 쌓입니다.
        </p>
      </div>

      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Summary label="결제합계" value={won(data?.summary.amountWon ?? 0)} />
        <Summary label="가맹점 수수료" value={won(data?.summary.merchantFeeWon ?? 0)} />
        <Summary label="서비스브릿지" value={won(data?.summary.serviceBridgeWon ?? 0)} />
        <Summary label="마진" value={won(data?.summary.marginWon ?? 0)} emphasis />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-slate-200 p-0.5">
            {PRESETS.map((preset) => {
              const on = datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={[
                    'rounded-md px-2.5 py-1 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
                    on ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                  onClick={() => write({ datePreset: preset.id === 'all' ? null : preset.id }, true)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {datePreset === 'month' ? (
            <YearMonthSelect value={month} onChange={(value) => write({ month: value }, true)} compact />
          ) : null}
          {datePreset === 'day' ? (
            <YmdSelect value={day} onChange={(value) => write({ day: value }, true)} compact />
          ) : null}
          <label className="text-fluid-xs text-slate-600">
            가맹점
            <select
              className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-fluid-xs text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
              value={tenantId}
              onChange={(e) => write({ tenantId: e.target.value || null }, true)}
            >
              <option value="">전체</option>
              {(data?.merchants ?? []).map((merchant) => (
                <option key={merchant.tenantId} value={merchant.tenantId}>
                  {merchant.name}
                  {merchant.deleted ? ' (삭제됨)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-fluid-2xs text-slate-500">
          완료 {data?.summary.approvedCount ?? 0}건 · 취소 {data?.summary.cancelCount ?? 0}건
          {loading ? ' · 불러오는 중' : ''}
        </p>
      </section>

      <ListPaginationBar
        mode="summary"
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={(next) => write({ page: next <= 1 ? null : String(next) })}
        onPageSizeChange={(size) => write({ pageSize: size === INQUIRY_LIST_DEFAULT_PAGE_SIZE ? null : String(size), page: null })}
      />

      <div className="space-y-2 lg:hidden">
        {(data?.items ?? []).map((item) => (
          <FeeCard
            key={item.tenantId}
            item={item}
            canManage={canManage}
            onSave={(feePercent) => api.saveFee(item.tenantId, feePercent).then(() => setReloadKey((n) => n + 1))}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}
        {!loading && (data?.items.length ?? 0) === 0 ? <p className="p-6 text-center text-fluid-sm text-slate-500">표시할 가맹점이 없습니다.</p> : null}
      </div>

      <div className="hidden w-full min-w-0 max-w-full overflow-x-auto lg:block">
        <table className="w-full border-collapse text-fluid-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-center text-slate-600">
              <th className="px-2 py-2 font-medium">가맹점</th>
              <th className="px-2 py-2 font-medium">수수료</th>
              <th className="px-2 py-2 font-medium">결제합계</th>
              <th className="px-2 py-2 font-medium">가맹점 수수료</th>
              <th className="px-2 py-2 font-medium">서비스브릿지</th>
              <th className="px-2 py-2 font-medium">마진</th>
              <th className="px-2 py-2 font-medium">건수</th>
              {canManage ? <th className="px-2 py-2 font-medium"> </th> : null}
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item.tenantId} className="border-b border-slate-100">
                <td className="max-w-[12rem] truncate px-2 py-2 text-center font-medium text-slate-900" title={item.name}>
                  {item.name}
                  {item.deleted ? <span className="ml-1 text-fluid-2xs text-red-700">삭제됨</span> : null}
                </td>
                <td className="px-2 py-2 text-center">
                  <FeeEditor
                    item={item}
                    canManage={canManage}
                    onSave={(feePercent) => api.saveFee(item.tenantId, feePercent).then(() => setReloadKey((n) => n + 1))}
                  />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{won(item.amountWon)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{won(item.merchantFeeWon)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{won(item.serviceBridgeWon)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${item.marginWon < 0 ? 'text-red-700' : ''}`}>{won(item.marginWon)}</td>
                <td className="px-2 py-2 text-center tabular-nums">
                  {item.approvedCount}
                  {item.cancelCount ? ` / 취소 ${item.cancelCount}` : ''}
                </td>
                {canManage ? (
                  <td className="px-2 py-2 text-center">
                    <DeleteButton disabled={item.deleted} onClick={() => setDeleteTarget(item)} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (data?.items.length ?? 0) === 0 ? <p className="p-8 text-center text-fluid-sm text-slate-500">표시할 가맹점이 없습니다.</p> : null}
      </div>

      {!loading ? (
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={pageSize}
          total={data?.total ?? 0}
          onPageChange={(next) => write({ page: next <= 1 ? null : String(next) })}
          onPageSizeChange={(size) => write({ pageSize: size === INQUIRY_LIST_DEFAULT_PAGE_SIZE ? null : String(size), page: null })}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteMerchantModal
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async (password) => {
            await api.remove(deleteTarget.tenantId, password);
            setDeleteTarget(null);
            setReloadKey((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function Summary({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-fluid-2xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-fluid-sm font-semibold tabular-nums ${emphasis ? 'text-slate-900' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function FeeEditor({
  item,
  canManage,
  onSave,
}: {
  item: PgFeeLedgerItem;
  canManage: boolean;
  onSave: (feePercent: number) => Promise<void>;
}) {
  const [value, setValue] = useState(percent(item.feeBps));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue(percent(item.feeBps)), [item.feeBps]);
  if (!canManage || item.deleted) return <span className="tabular-nums">{percent(item.feeBps)}%</span>;
  return (
    <form
      className="inline-flex items-center justify-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void onSave(Number(value))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : '저장하지 못했습니다.'))
          .finally(() => setBusy(false));
      }}
    >
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 rounded border border-slate-300 px-1.5 py-1 text-center text-fluid-xs tabular-nums focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
        aria-label={`${item.name} 수수료`}
      />
      <span className="text-slate-500">%</span>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-slate-900 px-2 py-1 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        저장
      </button>
      {error ? <span className="text-fluid-2xs text-red-700">{error}</span> : null}
    </form>
  );
}

function FeeCard({
  item,
  canManage,
  onSave,
  onDelete,
}: {
  item: PgFeeLedgerItem;
  canManage: boolean;
  onSave: (feePercent: number) => Promise<void>;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900" title={item.name}>
          {item.name}
        </p>
        {item.deleted ? <span className="text-fluid-2xs text-red-700">삭제됨</span> : null}
      </div>
      <p className="mt-1 text-fluid-xs text-slate-700">
        수수료 <FeeEditor item={item} canManage={canManage} onSave={onSave} />
      </p>
      <p className="mt-1 text-right text-fluid-xs tabular-nums text-slate-800">
        결제 {won(item.amountWon)} · 마진 {won(item.marginWon)}
      </p>
      <p className="text-right text-fluid-2xs tabular-nums text-slate-500">
        가맹점 {won(item.merchantFeeWon)} · 서비스브릿지 {won(item.serviceBridgeWon)}
      </p>
      {canManage && !item.deleted ? (
        <div className="mt-2 text-right">
          <DeleteButton onClick={onDelete} />
        </div>
      ) : null}
    </article>
  );
}

function DeleteButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-red-200 bg-white px-2 py-1 text-fluid-2xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    >
      삭제
    </button>
  );
}

function DeleteMerchantModal({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div className="modal-mobile-fullscreen-panel flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">가맹점 삭제</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-fluid-xs text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            닫기
          </button>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
          onFocusCapture={onFieldFocus}
        >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            void onConfirm(password)
              .catch((err: unknown) => setError(err instanceof Error ? err.message : '삭제하지 못했습니다.'))
              .finally(() => setBusy(false));
          }}
        >
          <p className="text-fluid-xs leading-snug text-slate-700">
            {name}의 가맹 연결을 끊습니다. 업체와 지난 결제 내역은 남고, 다시 카드결재를 받으려면 코드를 새로 연결해야 합니다.
          </p>
          <label className="block text-fluid-xs text-slate-600">
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-fluid-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </label>
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="min-h-10 w-full rounded-lg bg-red-700 text-fluid-sm font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? '삭제 중' : '삭제'}
          </button>
        </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
