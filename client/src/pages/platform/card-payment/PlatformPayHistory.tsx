import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  cancelUsageFeeCardPayment,
  closePlatformPayLink,
  fetchUsageFeeCardPayments,
  type UsageFeeCardPaymentRow,
} from '../../../api/platformCardPayment';
import { InlineConfirm } from '../../../components/ui/InlineConfirm';
import { ListPaginationBar } from '../../../components/ui/ListPaginationBar';
import { RowActions, type RowMenuItem } from '../../../components/ui/RowActions';
import { INQUIRY_LIST_PAGE_SIZE_OPTIONS, parseInquiryListPageSize, parseListPage } from '../../../utils/listPagination';
import { splitTaxIncluded } from '@shared/cardPayment';
import { PayDetailDrawer } from './PayDetailDrawer';

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'keyin', label: '수기' },
  { id: 'link', label: '링크' },
  { id: 'invoice', label: '이용료' },
  { id: 'proxy', label: '청소비 대신 받기' },
  { id: 'other', label: '기타' },
] as const;

const HEADS = ['날짜', '방식', '용도', '업체·건', '상품명', '금액', '상태', '작업'];

function chipClass(label: string): string {
  if (label === '결제 완료') return 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]';
  if (label === '결제 대기') return 'border-[#f0d27a] bg-[#fff6dc] text-[#7a5300]';
  if (label === '취소' || label === '결제 실패') return 'border-[#f3b8b1] bg-[#fdecea] text-[#b42318]';
  return 'border-[#dde3ea] bg-[#f1f3f6] text-[#5d6878]';
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}

function party(row: UsageFeeCardPaymentRow): string {
  return [row.tenantName, row.inquiryLabel].filter(Boolean).join(' · ');
}

function Chip({ label }: { label: string }) {
  return <span className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full border px-2 text-xs ${chipClass(label)}`}>{label}</span>;
}

export function PlatformPayHistory() {
  const [params, setParams] = useSearchParams();
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const filter = params.get('hist') || 'all';
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<UsageFeeCardPaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; kind: 'detail' | 'receipt' | 'cancel' | 'close' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(true);

  const channel = filter === 'keyin' ? 'KEYIN' : filter === 'link' ? 'LINK' : undefined;
  const purpose = filter === 'invoice' ? 'INVOICE' : filter === 'proxy' ? 'CLEANING_PROXY' : filter === 'other' ? 'OTHER' : undefined;

  const load = useCallback(() => {
    void fetchUsageFeeCardPayments(pageSize, (page - 1) * pageSize, undefined, { channel, purpose })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '결제 기록을 불러오지 못했습니다.'));
  }, [page, pageSize, channel, purpose]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function writeQuery(next: { page?: number; pageSize?: number; hist?: string }) {
    const query = new URLSearchParams(params);
    query.set('page', String(next.page ?? page));
    query.set('pageSize', String(next.pageSize ?? pageSize));
    if (next.hist) query.set('hist', next.hist);
    setParams(query, { replace: true });
  }

  function copyLink(row: UsageFeeCardPaymentRow) {
    if (!row.linkUrl) return;
    void navigator.clipboard.writeText(row.linkUrl).then(() => {
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function actions(row: UsageFeeCardPaymentRow) {
    const waiting = row.statusLabel === '결제 대기' && Boolean(row.linkUrl);
    const done = row.status === 'APPROVED';
    if (!waiting && !done) return { action: undefined, menu: undefined };
    if (waiting) {
      return {
        action: { label: copiedId === row.id ? '복사됨' : '링크 복사', onClick: () => copyLink(row) },
        menu: [{ label: '링크 닫기', danger: true, onSelect: () => setOpen({ id: row.id, kind: 'close' }) }],
      };
    }
    const menu: RowMenuItem[] = [{ label: '상세 보기', onSelect: () => setOpen({ id: row.id, kind: 'detail' }) }];
    if (row.cancelable) menu.push({ label: '전액 취소', danger: true, onSelect: () => setOpen({ id: row.id, kind: 'cancel' }) });
    return {
      action: { label: '영수증', onClick: () => setOpen({ id: row.id, kind: 'receipt' }) },
      menu,
    };
  }

  function extra(row: UsageFeeCardPaymentRow) {
    if (open?.id !== row.id) return null;
    if (open.kind === 'close' || open.kind === 'cancel') {
      const question = open.kind === 'close' ? '이 결제 링크를 닫을까요?' : `${row.amountKrw.toLocaleString('ko-KR')}원을 취소할까요?`;
      return (
        <InlineConfirm
          question={question}
          confirmLabel={open.kind === 'close' ? '닫기' : '취소하기'}
          busy={busy}
          onCancel={() => setOpen(null)}
          onConfirm={() => {
            setBusy(true);
            const task = open.kind === 'close'
              ? closePlatformPayLink(row.id)
              : row.payMethod === 'KEYIN'
                ? Promise.resolve().then(() => {
                    window.open('https://wspay.net', '_blank', 'noopener,noreferrer');
                  })
                : cancelUsageFeeCardPayment(row.id);
            void task
              .then(() => {
                setOpen(null);
                load();
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '처리하지 못했습니다.'))
              .finally(() => setBusy(false));
          }}
        />
      );
    }
    return null;
  }

  const detailRow = open && (open.kind === 'detail' || open.kind === 'receipt')
    ? items.find((row) => row.id === open.id) ?? null
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`h-7 whitespace-nowrap rounded-[7px] border px-2.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f4fb8] disabled:pointer-events-none disabled:opacity-45 ${
              filter === item.id ? 'border-[#111a2b] bg-[#111a2b] font-bold text-white' : 'border-[#dde3ea] bg-white text-[#141b26] hover:bg-[#eef2f7]'
            }`}
            onClick={() => writeQuery({ page: 1, hist: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
      <ListPaginationBar mode="summary" page={page} pageSize={pageSize} total={total} pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS} onPageChange={(next) => writeQuery({ page: next })} onPageSizeChange={(size) => writeQuery({ page: 1, pageSize: size })} />
      <div className="rounded-xl border border-[#dde3ea] bg-white">
      <div className="grid gap-2 p-2 lg:hidden">
        {items.map((row) => {
          const rowActions = actions(row);
          return (
            <article key={row.id} className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-xl border border-[#dde3ea] bg-white px-3.5 py-3" onClick={() => setOpen({ id: row.id, kind: 'detail' })}>
              <span className="truncate font-bold">{row.purposeLabel} · <span className="tabular-nums">{row.amountKrw.toLocaleString('ko-KR')}원</span></span>
              <span className="row-span-2 grid justify-items-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                <Chip label={row.statusLabel ?? ''} />
                <RowActions action={rowActions.action} menu={rowActions.menu} />
              </span>
              <span className="truncate text-xs tabular-nums text-[#5d6878]">{formatWhen(row.paidAt)} · {row.methodLabel}</span>
              {extra(row) ? <div className="col-span-2" onClick={(event) => event.stopPropagation()}>{extra(row)}</div> : null}
            </article>
          );
        })}
      </div>
      <div className="hidden w-full min-w-0 lg:block">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f6f8fb] text-xs font-medium text-[#5d6878]">
              {HEADS.map((head) => (
                <th key={head} className={`h-9 whitespace-nowrap px-3.5 text-center ${head === '작업' ? 'w-[132px]' : ''}`}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const rowActions = actions(row);
              return (
                <Fragment key={row.id}>
                  <tr className="cursor-pointer border-b border-[#dde3ea] hover:bg-[#eef2f7]" onClick={() => setOpen({ id: row.id, kind: 'detail' })}>
                    <td className="h-12 whitespace-nowrap px-3.5 text-center tabular-nums">{formatWhen(row.paidAt)}</td>
                    <td className="h-12 whitespace-nowrap px-3.5 text-center">{row.methodLabel}</td>
                    <td className="h-12 whitespace-nowrap px-3.5 text-center">{row.purposeLabel}</td>
                    <td className="h-12 max-w-[180px] truncate whitespace-nowrap px-3.5 text-center" title={party(row)}>{party(row)}</td>
                    <td className="h-12 max-w-[160px] truncate whitespace-nowrap px-3.5 text-center" title={row.goodsName}>{row.goodsName}</td>
                    <td className="h-12 whitespace-nowrap px-3.5 text-right tabular-nums">{row.amountKrw.toLocaleString('ko-KR')}원</td>
                    <td className="h-12 whitespace-nowrap px-3.5 text-center"><Chip label={row.statusLabel ?? ''} /></td>
                    <td className="h-12 whitespace-nowrap px-3.5 text-right" onClick={(event) => event.stopPropagation()}><RowActions action={rowActions.action} menu={rowActions.menu} /></td>
                  </tr>
                  {open?.id === row.id && extra(row) ? (
                    <tr key={`${row.id}-extra`} className="border-b border-[#dde3ea]">
                      <td colSpan={8} className="px-3.5">{extra(row)}</td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-8 text-center text-sm text-[#5d6878]">이 기간에 결제가 없어요. 기간을 넓혀 보세요.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {items.length === 0 ? <p className="p-6 text-center text-sm text-[#5d6878] lg:hidden">이 기간에 결제가 없어요. 기간을 넓혀 보세요.</p> : null}
      {total > pageSize ? (
        <ListPaginationBar mode="nav" page={page} pageSize={pageSize} total={total} pageSizeOptions={INQUIRY_LIST_PAGE_SIZE_OPTIONS} onPageChange={(next) => writeQuery({ page: next })} onPageSizeChange={(size) => writeQuery({ page: 1, pageSize: size })} />
      ) : null}
      </div>
      <PayDetailDrawer
        open={Boolean(detailRow)}
        wide={wide}
        title={open?.kind === 'receipt' ? '영수증' : '결제 상세'}
        onClose={() => setOpen(null)}
      >
        {detailRow ? <ServiceBridgePayDetail row={detailRow} /> : null}
      </PayDetailDrawer>
    </div>
  );
}

function ServiceBridgePayDetail({ row }: { row: UsageFeeCardPaymentRow }) {
  const split = splitTaxIncluded(row.amountKrw, row.supplyAmountKrw, row.vatAmountKrw);
  return (
    <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-[#5d6878]">상품명</dt>
      <dd>{row.goodsName}</dd>
      <dt className="text-[#5d6878]">고객</dt>
      <dd>{row.buyerName || ''}</dd>
      <dt className="text-[#5d6878]">공급가</dt>
      <dd className="tabular-nums">{split.supplyKrw.toLocaleString('ko-KR')}원</dd>
      <dt className="text-[#5d6878]">부가세</dt>
      <dd className="tabular-nums">{split.vatKrw.toLocaleString('ko-KR')}원</dd>
      <dt className="text-[#5d6878]">승인번호</dt>
      <dd className="tabular-nums">{row.approvalNo || ''}</dd>
      <dt className="text-[#5d6878]">카드</dt>
      <dd className="tabular-nums">{row.cardLast4 ? `····${row.cardLast4}` : ''}</dd>
    </dl>
  );
}
