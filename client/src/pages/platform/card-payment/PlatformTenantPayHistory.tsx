import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  fetchTenantPayDetail,
  fetchTenantPayHistory,
  type TenantPayDetail,
  type TenantPayList,
  type TenantPayRow,
} from '../../../api/platformTenantPayHistory';
import { Button } from '../../../components/ui/Button';
import { ListPaginationBar } from '../../../components/ui/ListPaginationBar';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { PlatformTenantPayDetail } from './PlatformTenantPayDetail';
import { cardLabel, installmentLabel, kstStamp, methodLabel, statusLabel, won } from './tenantPayFormat';

const PAGE_SIZE = 30;

function read(params: URLSearchParams, key: string, fallback = ''): string {
  return params.get(key) ?? fallback;
}

export function PlatformTenantPayHistory() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState<TenantPayList | null>(null);
  const [detail, setDetail] = useState<TenantPayDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wide, setWide] = useState(true);
  const [draftQ, setDraftQ] = useState(read(params, 'q'));
  const sheetRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(sheetRef, !wide && Boolean(detail));
  const [reload, setReload] = useState(0);
  const page = Math.max(1, Number(params.get('page') || '1'));
  const pageSize = [30, 50, 80, 100].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : PAGE_SIZE;
  const selectedId = params.get('pay');

  function setFilter(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.set('tab', 'tenant');
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in patch)) next.set('page', '1');
    setParams(next, { replace: true });
  }

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1000px)');
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    let stop = false;
    setError(null);
    void fetchTenantPayHistory({
      period: read(params, 'period', 'today'),
      from: read(params, 'from'),
      to: read(params, 'to'),
      tenantId: read(params, 'tenantId'),
      method: read(params, 'method'),
      status: read(params, 'status'),
      q: read(params, 'q'),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }).then((data) => {
      if (!stop) setList(data);
    }).catch((e: unknown) => {
      if (!stop) setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    });
    return () => {
      stop = true;
    };
  }, [params, page, pageSize, reload]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let stop = false;
    void fetchTenantPayDetail(selectedId).then((row) => {
      if (!stop) setDetail(row);
    }).catch(() => {
      if (!stop) setDetail(null);
    });
    return () => {
      stop = true;
    };
  }, [selectedId, list]);

  function selectRow(row: TenantPayRow) {
    setFilter({ pay: row.id, page: String(page) });
  }

  const summary = list?.summary;
  const detailNode = detail ? (
    <PlatformTenantPayDetail
      row={detail}
      onChanged={() => setReload((n) => n + 1)}
    />
  ) : (
    <p className="text-sm text-[#5d6878]">왼쪽 목록에서 결제를 고르면 상세가 열립니다.</p>
  );

  return (
    <div className="space-y-3 text-[#141b26]">
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4">
        {[
          ['승인', summary ? `${summary.approvedCount.toLocaleString('ko-KR')}건 · ${won(summary.approvedAmountWon)}` : '…'],
          ['취소', summary ? `${summary.cancelledCount.toLocaleString('ko-KR')}건 · ${won(summary.cancelledAmountWon)}` : '…'],
          ['업체 정산 예정', summary ? won(summary.tenantNetWon) : '…'],
          ['플랫폼 수익', summary ? won(summary.platformSpreadWon) : '…'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#dde3ea] bg-white px-3 py-2">
            <p className="text-xs text-[#5d6878]">{label}</p>
            <p className="text-sm font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ['today', '오늘'],
          ['7d', '최근 7일'],
          ['month', '이번 달'],
          ['custom', '직접'],
        ].map(([id, label]) => (
          <Button key={id} size="sm" variant={read(params, 'period', 'today') === id ? 'primary' : 'secondary'} onClick={() => setFilter({ period: id })}>
            {label}
          </Button>
        ))}
        {read(params, 'period') === 'custom' ? (
          <>
            <input type="date" value={read(params, 'from')} onChange={(e) => setFilter({ period: 'custom', from: e.target.value })} className="h-7 rounded-lg border border-[#dde3ea] px-2 text-xs" />
            <input type="date" value={read(params, 'to')} onChange={(e) => setFilter({ period: 'custom', to: e.target.value })} className="h-7 rounded-lg border border-[#dde3ea] px-2 text-xs" />
          </>
        ) : null}
        <select value={read(params, 'tenantId')} onChange={(e) => setFilter({ tenantId: e.target.value })} className="h-7 rounded-lg border border-[#dde3ea] bg-white px-2 text-xs">
          <option value="">가맹점 전체</option>
          {(list?.merchants ?? []).map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}
        </select>
        <select value={read(params, 'method')} onChange={(e) => setFilter({ method: e.target.value })} className="h-7 rounded-lg border border-[#dde3ea] bg-white px-2 text-xs">
          <option value="">방식 전체</option>
          <option value="KEYIN">수기</option>
          <option value="CUSTOMER_LINK">링크</option>
        </select>
        <select value={read(params, 'status')} onChange={(e) => setFilter({ status: e.target.value })} className="h-7 rounded-lg border border-[#dde3ea] bg-white px-2 text-xs">
          <option value="">상태 전체</option>
          <option value="APPROVED">승인</option>
          <option value="CANCELLED">취소</option>
          <option value="REQUEST">취소 요청</option>
        </select>
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter({ q: draftQ.trim() });
          }}
        >
          <input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="고객·승인번호·끝 4자리" className="h-7 w-44 rounded-lg border border-[#dde3ea] px-2 text-xs" />
          <Button size="sm" variant="secondary" type="submit">검색</Button>
        </form>
      </div>

      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
      <ListPaginationBar mode="summary" page={page} pageSize={pageSize} total={list?.total ?? 0} onPageChange={(next) => setFilter({ page: String(next) })} onPageSizeChange={(size) => setFilter({ pageSize: String(size), page: '1' })} />

      <div className="grid items-start gap-3 min-[1000px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-x-auto rounded-xl border border-[#dde3ea] bg-white">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="h-9 bg-[#f6f8fb] text-center text-xs text-[#5d6878]">
                {['승인 시각', '가맹점', '고객', '금액', '할부', '카드', '방식', '상태', '작업'].map((head) => (
                  <th key={head} className="px-2 font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(list?.items ?? []).map((row) => {
                const chip = statusLabel(row);
                const selected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    className={`h-12 cursor-pointer border-t border-[#eef2f6] text-center ${selected ? 'bg-[#eef3ff]' : 'hover:bg-[#eef2f7]'}`}
                    onClick={() => selectRow(row)}
                  >
                    <td className="px-2 whitespace-nowrap">{kstStamp(row.paidAt)}</td>
                    <td className="px-2">
                      <span className="block truncate">{row.merchantName}</span>
                      <span className="block truncate text-xs text-[#5d6878]">{row.brandName}</span>
                    </td>
                    <td className="px-2">{row.customerName}</td>
                    <td className="px-2 text-right tabular-nums">{won(row.amountWon)}</td>
                    <td className={`px-2 ${row.installmentMonths == null ? 'text-[#5d6878]' : ''}`}>{installmentLabel(row.installmentMonths)}</td>
                    <td className="px-2 whitespace-nowrap">{cardLabel(row)}</td>
                    <td className="px-2">{methodLabel(row.method)}</td>
                    <td className="px-2"><span className={`rounded-full border px-1.5 py-0.5 text-xs ${chip.className}`}>{chip.text}</span></td>
                    <td className="px-2">
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); selectRow(row); }}>상세</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list && list.items.length === 0 ? <p className="p-6 text-center text-sm text-[#5d6878]">이 조건의 결제가 없습니다.</p> : null}
        </div>
        {wide ? <aside className="sticky top-4 rounded-xl border border-[#dde3ea] bg-white p-4">{detailNode}</aside> : null}
      </div>
      <ListPaginationBar mode="nav" page={page} pageSize={pageSize} total={list?.total ?? 0} onPageChange={(next) => setFilter({ page: String(next) })} onPageSizeChange={(size) => setFilter({ pageSize: String(size), page: '1' })} />

      {!wide && detail ? createPortal(
        <div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={() => setFilter({ pay: '', page: String(page) })}>
          <div
            ref={sheetRef}
            className="modal-form-scroll-surface max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
            onFocusCapture={onFieldFocus}
          >
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setFilter({ pay: '', page: String(page) })}>닫기</Button>
            </div>
            {detailNode}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
