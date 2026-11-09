import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchWalletInvoiceQueue,
  retryPlatformWalletInvoice,
  retryPlatformWalletInvoicesBatch,
  type PlatformWalletInvoiceQueueRow,
} from '../../api/platformReceipts';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION } from '../../utils/platformUi';

function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function PlatformIssueQueueTab({ onQueueCount }: { onQueueCount?: (n: number) => void }) {
  const [items, setItems] = useState<PlatformWalletInvoiceQueueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWalletInvoiceQueue(100, 0);
      setItems(res.items);
      setTotal(res.total);
      onQueueCount?.(res.total);
      setError(null);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    }
  }, [onQueueCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (paymentId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.paymentId)));
  };

  const issueOne = async (paymentId: string) => {
    setBusyId(paymentId);
    setMessage(null);
    try {
      await retryPlatformWalletInvoice(paymentId);
      setMessage('발행 요청을 보냈습니다.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '발행에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const issueSelected = async () => {
    if (selected.size === 0) return;
    setBatchBusy(true);
    setMessage(null);
    try {
      const result = await retryPlatformWalletInvoicesBatch([...selected]);
      setMessage(`선택 발행 완료 · 성공 ${result.ok} · 실패 ${result.failed}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '일괄 발행에 실패했습니다.');
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <section className={`${CARD_SECTION} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          계좌이체 지갑 충전 중 세금계산서 대기·실패 {total.toLocaleString('ko-KR')}건
        </p>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={batchBusy || selected.size === 0}
          onClick={() => void issueSelected()}
        >
          {batchBusy ? '발행 중…' : `선택 발행 (${selected.size})`}
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="hidden w-full min-w-0 overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="px-2 py-2 text-center">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size === items.length}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              <th className="px-2 py-2 text-center">입금 확인일</th>
              <th className="px-2 py-2 text-center">업체</th>
              <th className="px-2 py-2 text-center">충전금</th>
              <th className="px-2 py-2 text-center">부가세</th>
              <th className="px-2 py-2 text-center">합계</th>
              <th className="px-2 py-2 text-center">상태</th>
              <th className="px-2 py-2 text-center">발행</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(row.paymentId)}
                    onChange={() => toggle(row.paymentId)}
                    aria-label={`${row.tenantName} 선택`}
                  />
                </td>
                <td className="px-2 py-2 text-center text-xs">{formatWhen(row.paidAt)}</td>
                <td className="px-2 py-2 text-center">
                  <Link
                    to={`/platform/tenants/${row.tenantId}#section-wallet`}
                    className="font-medium text-sky-700 hover:underline"
                  >
                    {row.tenantName}
                  </Link>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{won(row.supplyAmountKrw)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{won(row.vatAmountKrw)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">{won(row.totalAmountKrw)}</td>
                <td className="px-2 py-2 text-center text-xs">
                  {row.status === 'PENDING' ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">대기</span>
                  ) : (
                    <div className="space-y-1">
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">실패</span>
                      {row.error ? <p className="text-red-600">{row.error}</p> : null}
                      {row.missingBizInfo ? (
                        <Link
                          to={`/platform/tenants/${row.tenantId}`}
                          className="block text-sky-700 hover:underline"
                        >
                          업체 상세에서 사업자정보 입력
                        </Link>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={busyId === row.paymentId}
                    onClick={() => void issueOne(row.paymentId)}
                  >
                    {busyId === row.paymentId ? '요청 중…' : '발행하기'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 lg:hidden">
        {items.map((row) => (
          <article key={row.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(row.paymentId)}
                onChange={() => toggle(row.paymentId)}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-gray-900">{row.tenantName}</p>
                <p className="text-xs text-gray-500">{formatWhen(row.paidAt)}</p>
                <p className="text-sm tabular-nums text-gray-900">{won(row.totalAmountKrw)}</p>
                <p className="text-xs text-gray-600">
                  {row.status === 'PENDING' ? '대기' : `실패${row.error ? ` · ${row.error}` : ''}`}
                </p>
                {row.missingBizInfo ? (
                  <Link to={`/platform/tenants/${row.tenantId}`} className="text-xs text-sky-700 hover:underline">
                    업체 상세에서 사업자정보 입력
                  </Link>
                ) : null}
                <button
                  type="button"
                  className={`${BTN_SECONDARY} mt-1`}
                  disabled={busyId === row.paymentId}
                  onClick={() => void issueOne(row.paymentId)}
                >
                  {busyId === row.paymentId ? '요청 중…' : '발행하기'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {items.length === 0 && !error ? (
        <p className="py-8 text-center text-sm text-gray-500">발행할 건이 없습니다.</p>
      ) : null}
    </section>
  );
}
