import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  deleteQuotation,
  listQuotations,
  type QuotationDatePreset,
  type QuotationDto,
  type QuotationStatus,
} from '../../api/quotations';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { QuotationStatusBadge, qUi } from '../../components/quotations/quotationUi';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

const STATUS_OPTIONS: { value: '' | QuotationStatus; label: string }[] = [
  { value: '', label: '전체 상태' },
  { value: 'DRAFT', label: '작성 중' },
  { value: 'FINALIZED', label: '확정' },
  { value: 'SENT', label: '발송됨' },
];

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function AdminQuotationsListPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();

  const datePreset = (searchParams.get('datePreset') as QuotationDatePreset | null) ?? 'all';
  const monthKey = searchParams.get('month') ?? kstMonthKeyNow();
  const dayKey = searchParams.get('day') ?? kstYmdNow();
  const customerName = searchParams.get('customerName') ?? '';
  const statusFilter = (searchParams.get('status') as QuotationStatus | '') ?? '';
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const page = parseListPage(searchParams.get('page'));

  const [items, setItems] = useState<QuotationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuotationDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const safePage = useMemo(
    () => clampListPage(page, total, pageSize),
    [page, total, pageSize],
  );

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v == null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const offset = (safePage - 1) * pageSize;
    try {
      const data = await listQuotations(token, {
        limit: pageSize,
        offset,
        customerName: customerName.trim() || undefined,
        status: statusFilter || undefined,
        datePreset,
        month: datePreset === 'month' ? monthKey : undefined,
        day: datePreset === 'day' ? dayKey : undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, safePage, pageSize, customerName, statusFilter, datePreset, monthKey, dayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    if (!deletePassword.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteQuotation(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={qUi.pageRoot}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={qUi.breadcrumb}>
            <Link to="/admin/inquiries" className={qUi.breadcrumbLink}>
              서비스접수
            </Link>
            {' · '}
            견적서
          </p>
          <h1 className={qUi.pageTitle}>견적 목록</h1>
          <p className={qUi.pageDesc}>
            작성한 견적서를 조회·수정하고 PDF 발송 이력을 확인합니다.
          </p>
        </div>
        <Link to="/admin/inquiries/quotations/new" className={`${qUi.btnPrimary} shrink-0`}>
          + 새 견적서
        </Link>
      </div>

      <div className={qUi.card}>
        <div className={qUi.filterBar}>
          <div className="flex flex-col gap-3 min-w-0 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-fluid-2xs font-semibold text-slate-700 shrink-0">작성일</span>
              <div className="inline-flex flex-wrap items-center gap-2">
                <div className={qUi.segmentWrap}>
                  {(
                    [
                      ['today', '오늘'],
                      ['all', '전체'],
                      ['month', '월별'],
                      ['day', '일별'],
                    ] as const
                  ).map(([key, label], i) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchParams({ datePreset: key, page: '1' })}
                      className={qUi.segmentBtn(datePreset === key, i > 0)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {datePreset === 'month' && (
                  <YearMonthSelect
                    value={monthKey}
                    onChange={(v) => patchParams({ month: v, page: '1' })}
                    idPrefix="quotation-list-month"
                    className="items-center"
                  />
                )}
                {datePreset === 'day' && (
                  <YmdSelect
                    value={dayKey}
                    onChange={(v) => patchParams({ day: v, page: '1' })}
                    idPrefix="quotation-list-day"
                    className="items-center"
                  />
                )}
              </div>
            </div>
            <ListPaginationBar
              mode="summary"
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => patchParams({ page: String(p) })}
              onPageSizeChange={(s) => patchParams({ pageSize: String(s), page: '1' })}
              className="shrink-0"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="block min-w-0 flex-1 sm:max-w-xs">
              <span className={qUi.label}>상대 이름</span>
              <input
                className={qUi.input}
                value={customerName}
                onChange={(e) => patchParams({ customerName: e.target.value, page: '1' })}
                placeholder="이름으로 검색"
              />
            </label>
            <label className="block sm:w-40">
              <span className={qUi.label}>상태</span>
              <select
                className={qUi.select}
                value={statusFilter}
                onChange={(e) => patchParams({ status: e.target.value || null, page: '1' })}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <p className={`mx-4 mt-4 ${qUi.alertError}`} role="alert">{error}</p>}

        {loading ? (
          <p className={qUi.emptyState}>불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className={qUi.emptyState}>
            <p>견적서가 없습니다.</p>
            <Link
              to="/admin/inquiries/quotations/new"
              className={`${qUi.btnPrimary} mt-4 inline-flex`}
            >
              첫 견적서 작성
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className={qUi.table}>
                <thead>
                  <tr>
                    <th className={qUi.th}>견적번호</th>
                    <th className={qUi.th}>상대</th>
                    <th className={qUi.th}>접수</th>
                    <th className={`${qUi.th} text-right`}>합계</th>
                    <th className={qUi.th}>상태</th>
                    <th className={qUi.th}>작성일</th>
                    <th className={qUi.th}>최근 발송</th>
                    <th className={qUi.th} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className={qUi.tr}>
                      <td className={`${qUi.td} font-mono text-fluid-2xs tabular-nums`}>
                        {row.quoteNumber}
                      </td>
                      <td className={`${qUi.td} font-medium text-slate-900`}>{row.customerName}</td>
                      <td className={`${qUi.td} font-mono text-fluid-2xs text-slate-500`}>
                        {row.inquiry?.inquiryNumber ?? '—'}
                      </td>
                      <td className={`${qUi.td} text-right tabular-nums font-medium text-slate-900`}>
                        {row.total.toLocaleString('ko-KR')}원
                      </td>
                      <td className={qUi.td}>
                        <QuotationStatusBadge status={row.status} />
                      </td>
                      <td className={`${qUi.td} text-slate-500 whitespace-nowrap`}>
                        {new Date(row.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className={`${qUi.td} text-slate-500 whitespace-nowrap`}>
                        {(row.lastEmailedAt ?? row.sentAt)
                          ? new Date(row.lastEmailedAt ?? row.sentAt!).toLocaleDateString('ko-KR')
                          : '—'}
                      </td>
                      <td className={`${qUi.td} whitespace-nowrap`}>
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <Link
                            to={`/admin/inquiries/quotations/${row.id}`}
                            className={qUi.btnChip}
                          >
                            열기
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(row);
                              setDeletePassword('');
                            }}
                            className={qUi.btnDanger}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="lg:hidden divide-y divide-slate-100 p-3 space-y-3">
              {items.map((row) => (
                <li key={row.id} className={qUi.mobileCard}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{row.customerName}</p>
                      <p className="mt-0.5 font-mono text-fluid-2xs text-slate-500 tabular-nums">
                        {row.quoteNumber}
                      </p>
                    </div>
                    <QuotationStatusBadge status={row.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-fluid-xs text-slate-500">
                    <span className="tabular-nums font-medium text-slate-800">
                      {row.total.toLocaleString('ko-KR')}원
                    </span>
                    <span>{new Date(row.createdAt).toLocaleDateString('ko-KR')}</span>
                    {row.inquiry?.inquiryNumber && (
                      <span className="font-mono">접수 {row.inquiry.inquiryNumber}</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/admin/inquiries/quotations/${row.id}`}
                      className={`${qUi.btnSecondary} flex-1 text-center`}
                    >
                      열기
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(row);
                        setDeletePassword('');
                      }}
                      className={qUi.btnDanger}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ListPaginationBar
        page={safePage}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => patchParams({ page: String(p) })}
        onPageSizeChange={(s) => patchParams({ pageSize: String(s), page: '1' })}
      />

      {deleteTarget && (
        <div
          className={qUi.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div className={`${qUi.modalPanel} sm:max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <ModalCloseButton onClick={() => setDeleteTarget(null)} disabled={deleting} />
            <div className={qUi.modalHeader}>
              <h2 className="font-semibold text-rose-700">견적서 삭제</h2>
            </div>
            <div className="p-4">
              <p className="text-fluid-sm text-slate-600 mb-3">
                <span className="font-mono font-medium text-slate-800">{deleteTarget.quoteNumber}</span>
                {' — '}
                {deleteTarget.customerName}
              </p>
              <label className="block">
                <span className={qUi.label}>로그인 비밀번호</span>
                <input
                  type="password"
                  className={qUi.input}
                  placeholder="비밀번호 입력"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </label>
            </div>
            <div className={qUi.modalFooter}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className={qUi.btnSecondary}
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
