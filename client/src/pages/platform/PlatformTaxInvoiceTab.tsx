import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  listPlatformTaxInvoices,
  cancelPlatformTaxInvoice,
  fetchPlatformTaxInvoiceMonthStats,
  fetchPlatformReceiptMailUrl,
  downloadPlatformTaxInvoiceExcel,
  type PlatformTaxInvoiceRow,
  type PlatformReceiptMonthStats,
} from '../../api/platformReceipts';
import { createPlatformTaxInvoiceAdapter } from '../../components/taxinvoice/taxInvoiceIssueAdapter';
import { TaxInvoiceIssueWorkspace } from '../../components/taxinvoice/TaxInvoiceIssueWorkspace';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { BTN_PRIMARY, CARD_SECTION } from '../../utils/platformUi';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { parseListPage } from '../../utils/listPagination';
import { PlatformReceiptsFilterBar, useReceiptFilterRange } from './PlatformReceiptsFilterBar';
import { parseReceiptStatus } from './platformReceiptsFilters';

const PAGE_SIZE = 30;

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function statusBadge(status: PlatformTaxInvoiceRow['status']): string {
  if (status === 'ISSUED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-500';
  return 'bg-red-50 text-red-700';
}
function statusLabel(status: PlatformTaxInvoiceRow['status']): string {
  if (status === 'ISSUED') return '발행됨';
  if (status === 'CANCELLED') return '취소됨';
  return '실패';
}

export function PlatformTaxInvoiceTab({ certValid = true }: { certValid?: boolean }) {
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
  const [items, setItems] = useState<PlatformTaxInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listErr, setListErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // 발행 폼 표시 여부
  const [showForm, setShowForm] = useState(false);

  // 취소
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  // 플랫폼 어댑터 (마운트 시 1회 생성)
  const platformAdapter = useMemo(() => createPlatformTaxInvoiceAdapter(), []);

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
    listPlatformTaxInvoices(listFilter)
      .then((res) => { setItems(res.items); setTotal(res.total); setListErr(null); })
      .catch((e: unknown) => setListErr(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'));
  }, [listFilter]);

  useEffect(() => { loadList(); }, [loadList, filterKey]);

  useEffect(() => {
    fetchPlatformTaxInvoiceMonthStats({
      from: range.from,
      to: range.to,
      status: status || undefined,
      q: q || undefined,
    }).then(setStats).catch(() => undefined);
  }, [range.from, range.to, status, q]);

  function patchParams(patch: Record<string, string | null>, resetPage = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.set('page', '1');
    setParams(next, { replace: true });
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadPlatformTaxInvoiceExcel({
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

  async function handleCancel(id: string) {
    if (!window.confirm('세금계산서를 취소하시겠습니까?')) return;
    setCancellingId(id);
    setCancelErr(null);
    try {
      await cancelPlatformTaxInvoice(id);
      loadList();
    } catch (e) {
      setCancelErr(e instanceof Error ? e.message : '취소에 실패했습니다.');
    } finally {
      setCancellingId(null);
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
          <h2 className="text-base font-semibold text-gray-900">세금계산서 발행</h2>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!certValid}
            title={!certValid ? '공동인증서를 먼저 등록해 주세요' : undefined}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? '닫기' : '+ 발행하기'}
          </button>
        </div>
        {showForm ? (
          <div className="mt-4 border-t border-gray-100 pt-2">
            <TaxInvoiceIssueWorkspace
              embedded
              adapter={platformAdapter}
              onDone={(id) => {
                setShowForm(false);
                loadList();
                fetchPlatformTaxInvoiceMonthStats({
                  from: range.from,
                  to: range.to,
                  status: status || undefined,
                  q: q || undefined,
                }).then(setStats).catch(() => undefined);
                // toast with copy buttons would be nice; for now just reload
                void fetchPlatformReceiptMailUrl('taxinvoice', id, 'mail').then((url) => {
                  // pre-warm the url — ignore result
                  void url;
                }).catch(() => undefined);
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
                  <p className="mt-1 truncate text-sm font-medium text-gray-900">{row.buyerCorpName}</p>
                  <p className="text-xs text-gray-500">{row.writeDate}{row.tenantName ? ` · ${row.tenantName}` : ''}</p>
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums text-gray-900">{won(row.totalAmountKrw)}</p>
              </div>
              {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
              <div className="mt-2 flex justify-end gap-2">
                {row.status === 'ISSUED' ? (
                  <ReceiptRowMenu
                    kind="taxinvoice"
                    issueId={row.id}
                    official={row.status === 'ISSUED'}
                    publicToken={null}
                    copyReady={false}
                    canCancel={row.status === 'ISSUED'}
                    cancelling={cancellingId === row.id}
                    onCancel={() => void handleCancel(row.id)}
                    mailUrlResolver={(mode) => fetchPlatformReceiptMailUrl('taxinvoice', row.id, mode)}
                  />
                ) : null}
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
                <th className="px-2 py-2 text-left">작성일</th>
                <th className="px-2 py-2 text-left">매수자</th>
                <th className="px-2 py-2 text-left">업체</th>
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
                  <td className="px-2 py-2 text-xs">{row.writeDate}</td>
                  <td className="px-2 py-2 text-xs">{row.buyerCorpName}<br /><span className="text-gray-400">{row.buyerCorpNum}</span></td>
                  <td className="px-2 py-2 text-xs text-gray-500">{row.tenantName ?? '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">{won(row.totalAmountKrw)}</td>
                  <td className="px-2 py-2 text-center">
                    <ReceiptRowMenu
                      kind="taxinvoice"
                      issueId={row.id}
                      official={row.status === 'ISSUED'}
                      publicToken={null}
                      copyReady={false}
                      canCancel={row.status === 'ISSUED'}
                      cancelling={cancellingId === row.id}
                      onCancel={() => void handleCancel(row.id)}
                      compact
                      mailUrlResolver={(mode) => fetchPlatformReceiptMailUrl('taxinvoice', row.id, mode)}
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
