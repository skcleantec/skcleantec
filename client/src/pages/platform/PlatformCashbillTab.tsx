import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listPlatformCashbills,
  cancelPlatformCashbill,
  fetchPlatformCashbillMonthStats,
  fetchPlatformTenantsForBuyer,
  fetchPlatformReceiptMailUrl,
  downloadPlatformCashbillExcel,
  type PlatformCashbillRow,
  type PlatformReceiptMonthStats,
  type PlatformBuyerTenant,
} from '../../api/platformReceipts';
import { createPlatformCashbillAdapter } from '../../components/cashbill/cashbillIssueAdapter';
import { CashbillIssueForm } from '../../components/cashbill/CashbillIssueForm';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import type { CashbillBrand } from '../../api/cashbillIssues';
import { BTN_PRIMARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { parseListPage } from '../../utils/listPagination';
import { PlatformReceiptsFilterBar, useReceiptFilterRange } from './PlatformReceiptsFilterBar';
import { parseReceiptStatus } from './platformReceiptsFilters';

const PAGE_SIZE = 30;

/** 플랫폼 현금영수증 발행용 가짜 브랜드 */
const PLATFORM_CASHBILL_BRAND: CashbillBrand = {
  id: 'platform',
  name: '서비스브릿지',
  linked: true,
  taxType: null,
};

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function statusBadge(status: PlatformCashbillRow['status']): string {
  if (status === 'ISSUED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-500';
  return 'bg-red-50 text-red-700';
}
function statusLabel(status: PlatformCashbillRow['status']): string {
  if (status === 'ISSUED') return '발행됨';
  if (status === 'CANCELLED') return '취소됨';
  return '실패';
}
function usageLabel(usage: PlatformCashbillRow['usage']): string {
  if (usage === 'phone') return '소득공제';
  if (usage === 'biz') return '지출증빙';
  return '자진발급';
}

export function PlatformCashbillTab() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const range = useReceiptFilterRange(params);
  const status = parseReceiptStatus(params.get('status'));
  const q = params.get('q') || '';
  const filterKey = useMemo(
    () => `${range.from}|${range.to}|${status}|${q}|${page}`,
    [range.from, range.to, status, q, page],
  );

  const [stats, setStats] = useState<PlatformReceiptMonthStats | null>(null);
  const [items, setItems] = useState<PlatformCashbillRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listErr, setListErr] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<PlatformBuyerTenant[]>([]);
  const [exporting, setExporting] = useState(false);

  // 발행 폼 토글
  const [showForm, setShowForm] = useState(false);
  // 업체 선택 (플랫폼 발행 시 tenantId)
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // 취소
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  // 플랫폼 어댑터 (마운트 시 1회 생성)
  const platformAdapter = useMemo(() => createPlatformCashbillAdapter(), []);

  const listFilter = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      status: status || undefined,
      q: q || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [range.from, range.to, status, q, page],
  );

  const loadList = useCallback(() => {
    listPlatformCashbills(listFilter)
      .then((res) => { setItems(res.items); setTotal(res.total); setListErr(null); })
      .catch((e: unknown) => setListErr(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'));
  }, [listFilter]);

  useEffect(() => { loadList(); }, [loadList, filterKey]);

  useEffect(() => {
    fetchPlatformCashbillMonthStats({
      from: range.from,
      to: range.to,
      status: status || undefined,
      q: q || undefined,
    })
      .then(setStats)
      .catch(() => undefined);
  }, [range.from, range.to, status, q]);

  useEffect(() => {
    fetchPlatformTenantsForBuyer()
      .then((res) => setBuyers(res.items))
      .catch(() => undefined);
  }, []);

  function patchParams(patch: Record<string, string | null>, resetPage = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.set('page', '1');
    setParams(next, { replace: true });
  }

  async function handleCancel(id: string) {
    if (!window.confirm('현금영수증을 취소하시겠습니까?')) return;
    setCancellingId(id);
    setCancelErr(null);
    try {
      await cancelPlatformCashbill(id);
      loadList();
    } catch (e) {
      setCancelErr(e instanceof Error ? e.message : '취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadPlatformCashbillExcel({
        from: range.from,
        to: range.to,
        status: status || undefined,
        q: q || undefined,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '엑셀을 받지 못했습니다.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PlatformReceiptsFilterBar params={params} onChange={patchParams} onExport={() => void handleExport()} exporting={exporting} />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: `발행 건수 · ${range.label}`, value: `${stats.count.toLocaleString('ko-KR')}건` },
            { label: `바로빌 원가 · ${range.label}`, value: won(stats.costKrw ?? 0) },
            { label: `공급가 · ${range.label}`, value: won(stats.supplyAmountKrw) },
            { label: `총액 · ${range.label}`, value: won(stats.totalAmountKrw) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* 발행 폼 */}
      <section className={CARD_SECTION}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">현금영수증 발행</h2>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '닫기' : '+ 발행하기'}
          </button>
        </div>
        {showForm ? (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {/* 업체 선택 */}
            <label className="block space-y-1 text-sm text-gray-700">
              업체 (선택 시 발행 내역에 연결됨)
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className={`${INPUT_BASE} mt-1`}
              >
                <option value="">업체 선택 안 함</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <CashbillIssueForm
              brands={[PLATFORM_CASHBILL_BRAND]}
              embedded
              adapter={platformAdapter}
              platformTenantId={selectedTenantId || undefined}
              onClose={() => setShowForm(false)}
              onDone={(_id) => {
                setShowForm(false);
                setSelectedTenantId('');
                loadList();
                fetchPlatformCashbillMonthStats({
                  from: range.from,
                  to: range.to,
                  status: status || undefined,
                  q: q || undefined,
                }).then(setStats).catch(() => undefined);
              }}
            />
          </div>
        ) : null}
      </section>

      {/* 목록 */}
      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">발행 목록</h2>
        {listErr ? <p className="text-sm text-red-700">{listErr}</p> : null}
        {cancelErr ? <p className="text-sm text-red-700">{cancelErr}</p> : null}
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={(next) => patchParams({ page: String(next) })}
          onPageSizeChange={() => undefined}
        />
        {/* 모바일 카드 */}
        <div className="space-y-2 lg:hidden">
          {items.map((row) => (
            <article key={row.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                  <p className="mt-1 truncate text-sm font-medium text-gray-900">{row.buyerName ?? '—'}{row.tenantName ? ` (${row.tenantName})` : ''}</p>
                  <p className="text-xs text-gray-500">{row.tradeDate} · {usageLabel(row.usage)} · {row.taxKind === 'taxable' ? '과세' : '면세'}</p>
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums text-gray-900">{won(row.amountKrw)}</p>
              </div>
              {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
              <div className="mt-2 flex justify-end gap-2">
                <ReceiptRowMenu
                  kind="cashbill"
                  issueId={row.id}
                  official={row.status === 'ISSUED'}
                  publicToken={null}
                  copyReady={false}
                  canCancel={row.status === 'ISSUED'}
                  cancelling={cancellingId === row.id}
                  onCancel={() => void handleCancel(row.id)}
                  mailUrlResolver={(mode) => fetchPlatformReceiptMailUrl('cashbill', row.id, mode)}
                />
              </div>
            </article>
          ))}
          {items.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">발행 내역이 없습니다.</p> : null}
        </div>
        {/* PC 테이블 */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="px-2 py-2 text-center">상태</th>
                <th className="px-2 py-2 text-left">거래일</th>
                <th className="px-2 py-2 text-left">업체/고객</th>
                <th className="px-2 py-2 text-center">용도</th>
                <th className="px-2 py-2 text-right">공급가</th>
                <th className="px-2 py-2 text-right">부가세</th>
                <th className="px-2 py-2 text-right">합계</th>
                <th className="px-2 py-2 text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                    {row.error ? <p className="mt-0.5 text-xs text-red-500">{row.error}</p> : null}
                  </td>
                  <td className="px-2 py-2 text-xs">{row.tradeDate}</td>
                  <td className="px-2 py-2 text-xs">
                    {row.buyerName ?? '—'}
                    {row.tenantName ? <span className="text-gray-400"> / {row.tenantName}</span> : null}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">{usageLabel(row.usage)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{won(row.amountKrw)}</td>
                  <td className="px-2 py-2 text-center">
                    <ReceiptRowMenu
                      kind="cashbill"
                      issueId={row.id}
                      official={row.status === 'ISSUED'}
                      publicToken={null}
                      copyReady={false}
                      canCancel={row.status === 'ISSUED'}
                      cancelling={cancellingId === row.id}
                      onCancel={() => void handleCancel(row.id)}
                      compact
                      mailUrlResolver={(mode) => fetchPlatformReceiptMailUrl('cashbill', row.id, mode)}
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-500">발행 내역이 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={(next) => patchParams({ page: String(next) })}
          onPageSizeChange={() => undefined}
        />
      </section>
    </div>
  );
}
