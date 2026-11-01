import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
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
import { FilterBar, FilterSearch, FilterSegment, FilterSelect } from '../../components/ui/FilterBar';
import { Button } from '../../components/ui/Button';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
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

const DATE_PRESET_OPTIONS = [
  ['today', '오늘'],
  ['all', '전체'],
  ['month', '월별'],
  ['day', '일별'],
] as const;

/** 「열기」 링크 — Button sm secondary와 같은 모양 */
const OPEN_LINK_SM =
  'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-[7px] border border-[#dde3ea] bg-white px-2.5 text-fluid-2xs font-medium leading-none text-[#141b26] hover:bg-[#eef2f7]';
const OPEN_LINK_MD =
  'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-[#dde3ea] bg-white px-3.5 text-fluid-xs font-medium leading-none text-[#141b26] hover:bg-[#eef2f7]';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function kstYmdNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function formatQuotationIssuer(createdBy: QuotationDto['createdBy']): string {
  if (!createdBy) return '—';
  const name = createdBy.name?.trim();
  if (name) return name;
  return createdBy.email?.trim() || '—';
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
          <PageTitleWithFavorite label="견적 목록">
            <h1 className={qUi.pageTitle}>견적 목록</h1>
          </PageTitleWithFavorite>
          <p className={qUi.pageDesc}>
            작성한 견적서를 조회·수정하고 PDF 발송 이력을 확인합니다.
          </p>
        </div>
        <Link to="/admin/inquiries/quotations/new" className={`${qUi.btnPrimary} shrink-0`}>
          + 새 견적서
        </Link>
      </div>

      <div className={qUi.card}>
        <div className="border-b border-slate-100 p-3">
          <FilterBar
            period={(
              <>
                <span className="shrink-0 text-fluid-2xs font-semibold text-slate-600">작성일</span>
                <FilterSegment
                  label="작성일"
                  value={datePreset}
                  options={DATE_PRESET_OPTIONS}
                  onChange={(key) => patchParams({ datePreset: key, page: '1' })}
                />
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
              </>
            )}
            search={(
              <FilterSearch
                value={customerName}
                onSearch={(v) => patchParams({ customerName: v, page: '1' })}
                placeholder="상대 이름 검색"
                debounceMs={0}
              />
            )}
            activeCount={statusFilter ? 1 : 0}
          >
            <FilterSelect
              label="상태"
              value={statusFilter}
              onChange={(v) => patchParams({ status: v || null, page: '1' })}
              options={STATUS_OPTIONS.map((o) => [o.value, o.label] as const)}
            />
          </FilterBar>
          <div className="mt-2 flex justify-end">
            <ListPaginationBar
              mode="summary"
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => patchParams({ page: String(p) })}
              onPageSizeChange={(sz) => patchParams({ pageSize: String(sz), page: '1' })}
              className="shrink-0"
            />
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
                    <th className={qUi.th}>발행자</th>
                    <th className={qUi.th}>작성일</th>
                    <th className={qUi.th}>최근 발송</th>
                    <th className={qUi.th} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className={qUi.tr}>
                      <td className={`${qUi.td} text-fluid-2xs tabular-nums text-slate-600`}>
                        {row.quoteNumber}
                      </td>
                      <td className={`${qUi.td} font-medium text-slate-900`}>
                        <span className="inline-flex max-w-full items-center justify-center gap-1">
                          <span className="truncate">{row.customerName}</span>
                          {row.recipientKind === 'PARTNER' ? (
                            <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0 text-fluid-2xs font-medium text-amber-800 ring-1 ring-amber-200">
                              타업체
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className={`${qUi.td} text-fluid-2xs tabular-nums text-slate-500`}>
                        {row.inquiry?.inquiryNumber ?? '—'}
                      </td>
                      <td className={`${qUi.td} text-right tabular-nums font-medium text-slate-900`}>
                        {row.total.toLocaleString('ko-KR')}원
                      </td>
                      <td className={qUi.td}>
                        <QuotationStatusBadge status={row.status} />
                      </td>
                      <td
                        className={`${qUi.td} text-slate-700 truncate max-w-[8rem]`}
                        title={formatQuotationIssuer(row.createdBy)}
                      >
                        {formatQuotationIssuer(row.createdBy)}
                      </td>
                      <td className={`${qUi.td} text-fluid-2xs tabular-nums text-slate-500 whitespace-nowrap`}>
                        {formatDateCompactWithWeekday(row.createdAt)}
                      </td>
                      <td className={`${qUi.td} text-fluid-2xs tabular-nums text-slate-500 whitespace-nowrap`}>
                        {(row.lastEmailedAt ?? row.sentAt)
                          ? formatDateCompactWithWeekday(row.lastEmailedAt ?? row.sentAt!)
                          : '—'}
                      </td>
                      <td className={`${qUi.td} whitespace-nowrap`}>
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <Link
                            to={`/admin/inquiries/quotations/${row.id}`}
                            className={OPEN_LINK_SM}
                          >
                            열기
                          </Link>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteTarget(row);
                              setDeletePassword('');
                            }}
                          >
                            삭제
                          </Button>
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
                      <p className="flex items-center gap-1 font-semibold text-slate-900">
                        <span className="truncate">{row.customerName}</span>
                        {row.recipientKind === 'PARTNER' ? (
                          <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0 text-fluid-2xs font-medium text-amber-800 ring-1 ring-amber-200">
                            타업체
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-fluid-2xs text-slate-500 tabular-nums">
                        {row.quoteNumber}
                      </p>
                    </div>
                    <QuotationStatusBadge status={row.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-fluid-xs text-slate-500">
                    <span className="tabular-nums font-medium text-slate-800">
                      {row.total.toLocaleString('ko-KR')}원
                    </span>
                    <span className="tabular-nums">{formatDateCompactWithWeekday(row.createdAt)}</span>
                    <span title="발행자">{formatQuotationIssuer(row.createdBy)}</span>
                    {row.inquiry?.inquiryNumber && (
                      <span className="tabular-nums">접수 {row.inquiry.inquiryNumber}</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link
                      to={`/admin/inquiries/quotations/${row.id}`}
                      className={`${OPEN_LINK_MD} flex-1`}
                    >
                      열기
                    </Link>
                    <Button
                      size="md"
                      variant="danger"
                      onClick={() => {
                        setDeleteTarget(row);
                        setDeletePassword('');
                      }}
                    >
                      삭제
                    </Button>
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
                <span className="font-medium tabular-nums text-slate-800">{deleteTarget.quoteNumber}</span>
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
              <Button size="md" variant="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                취소
              </Button>
              <Button size="md" variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? '삭제 중…' : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
