import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cancelPlatformCashbill,
  cancelPlatformTaxInvoice,
  cancelPlatformWalletInvoice,
  downloadPlatformIssuedExcel,
  fetchPlatformReceiptMailUrl,
  fetchPlatformReceiptViewUrl,
  listPlatformIssuedReceipts,
  type PlatformIssuedReceiptRow,
  type PlatformReceiptMonthStats,
} from '../../api/platformReceipts';
import { openReceiptWindow } from '../../components/receipts/receiptListDisplay';
import { ReceiptRowMenu } from '../../components/receipts/ReceiptRowMenu';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { BTN_DANGER, BTN_SECONDARY, CARD_SECTION } from '../../utils/platformUi';
import { parseListPage } from '../../utils/listPagination';
import { PlatformReceiptsFilterBar, useReceiptFilterRange } from './PlatformReceiptsFilterBar';
import { parseReceiptKind, parseReceiptStatus } from './platformReceiptsFilters';

const PAGE_SIZE = 30;

function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function statusCls(status: PlatformIssuedReceiptRow['status']) {
  if (status === 'ISSUED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-500';
  return 'bg-red-50 text-red-700';
}

function statusLabel(status: PlatformIssuedReceiptRow['status']) {
  if (status === 'ISSUED') return '발행';
  if (status === 'CANCELLED') return '취소';
  return '실패';
}

export function PlatformIssuedListTab() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const range = useReceiptFilterRange(params);
  const status = parseReceiptStatus(params.get('status'));
  const kind = parseReceiptKind(params.get('kind'));
  const q = params.get('q') || '';
  const filterKey = useMemo(
    () => `${range.from}|${range.to}|${status}|${kind}|${q}|${page}`,
    [range.from, range.to, status, kind, q, page],
  );

  const [items, setItems] = useState<PlatformIssuedReceiptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<PlatformReceiptMonthStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const patchParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (resetPage) next.set('page', '1');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const load = useCallback(async () => {
    try {
      const res = await listPlatformIssuedReceipts({
        from: range.from,
        to: range.to,
        status: status || undefined,
        kind: kind || undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
      setStats(res.stats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    }
  }, [filterKey, page, q, range.from, range.to, status, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const openView = async (row: PlatformIssuedReceiptRow) => {
    setBusyId(row.id);
    try {
      const url = await fetchPlatformReceiptViewUrl({
        source: row.source,
        id: row.id,
        paymentId: row.paymentId ?? undefined,
        tenantId: row.tenantId,
      });
      openReceiptWindow(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '영수증을 열 수 없습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelRow = async (row: PlatformIssuedReceiptRow) => {
    if (!window.confirm('이 영수증을 취소할까요?')) return;
    setBusyId(row.id);
    try {
      if (row.source === 'cashbill') await cancelPlatformCashbill(row.id);
      else if (row.source === 'taxinvoice') await cancelPlatformTaxInvoice(row.id);
      else if (row.paymentId) await cancelPlatformWalletInvoice(row.paymentId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <PlatformReceiptsFilterBar
        params={params}
        onChange={patchParams}
        showKind
        onExport={() => {
          setExporting(true);
          void downloadPlatformIssuedExcel({
            from: range.from,
            to: range.to,
            status: status || undefined,
            kind: kind || undefined,
            q: q || undefined,
          })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : '엑셀을 받지 못했습니다.'))
            .finally(() => setExporting(false));
        }}
        exporting={exporting}
      />

      {stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['건수', `${stats.count.toLocaleString('ko-KR')}건`],
            ['공급가', won(stats.supplyAmountKrw)],
            ['부가세', won(stats.vatAmountKrw)],
            ['합계', won(stats.totalAmountKrw)],
          ].map(([label, value]) => (
            <div key={label} className={`${CARD_SECTION} !p-3`}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className={CARD_SECTION}>
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={(next) => patchParams({ page: String(next) })}
          onPageSizeChange={() => undefined}
        />
        <div className="hidden w-full min-w-0 overflow-x-auto lg:block">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="px-2 py-2 text-center">발행일</th>
                <th className="px-2 py-2 text-center">종류</th>
                <th className="px-2 py-2 text-center">업체/고객</th>
                <th className="px-2 py-2 text-center">용도</th>
                <th className="px-2 py-2 text-center">공급가</th>
                <th className="px-2 py-2 text-center">부가세</th>
                <th className="px-2 py-2 text-center">합계</th>
                <th className="px-2 py-2 text-center">상태</th>
                <th className="px-2 py-2 text-center">국세청 승인번호</th>
                <th className="px-2 py-2 text-center">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.source}-${row.id}`} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-center text-xs">{formatWhen(row.issuedAt)}</td>
                  <td className="px-2 py-2 text-center">{row.kindLabel}</td>
                  <td className="px-2 py-2 text-center">{row.partyName}</td>
                  <td className="px-2 py-2 text-center">{row.purposeLabel}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.supplyAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.vatAmountKrw)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.totalAmountKrw)}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCls(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{row.ntsConfirmNum ?? '—'}</td>
                  <td className="px-2 py-2 text-center">
                    {row.source === 'taxinvoice' || row.source === 'cashbill' ? (
                      <ReceiptRowMenu
                        kind={row.source}
                        issueId={row.id}
                        official={row.status === 'ISSUED'}
                        publicToken={null}
                        copyReady={false}
                        canCancel={row.canCancel}
                        cancelling={busyId === row.id}
                        onCancel={() => void cancelRow(row)}
                        compact
                        mailUrlResolver={(mode) => fetchPlatformReceiptMailUrl(row.source as 'taxinvoice' | 'cashbill', row.id, mode)}
                      />
                    ) : row.canView ? (
                      <button
                        type="button"
                        className={BTN_SECONDARY}
                        disabled={busyId === row.id}
                        onClick={() => void openView(row)}
                      >
                        영수증 보기
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 lg:hidden">
          {items.map((row) => (
            <article key={`${row.source}-${row.id}`} className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-900">
                {row.kindLabel} · {row.partyName}
              </p>
              <p className="text-xs text-gray-500">
                {formatWhen(row.issuedAt)} · {row.purposeLabel} · {statusLabel(row.status)}
              </p>
              <p className="mt-1 text-sm tabular-nums text-gray-900">{won(row.totalAmountKrw)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.source === 'taxinvoice' || row.source === 'cashbill' ? (
                  <ReceiptRowMenu
                    kind={row.source}
                    issueId={row.id}
                    official={row.status === 'ISSUED'}
                    publicToken={null}
                    copyReady={false}
                    canCancel={row.canCancel}
                    cancelling={busyId === row.id}
                    onCancel={() => void cancelRow(row)}
                    mailUrlResolver={(mode) => fetchPlatformReceiptMailUrl(row.source as 'taxinvoice' | 'cashbill', row.id, mode)}
                  />
                ) : (
                  <>
                    {row.canView ? (
                      <button
                        type="button"
                        className={BTN_SECONDARY}
                        disabled={busyId === row.id}
                        onClick={() => void openView(row)}
                      >
                        영수증 보기
                      </button>
                    ) : null}
                    {row.canCancel ? (
                      <button
                        type="button"
                        className={BTN_DANGER}
                        disabled={busyId === row.id}
                        onClick={() => void cancelRow(row)}
                      >
                        취소
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>

        {items.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-gray-500">발행 내역이 없습니다.</p>
        ) : null}
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
