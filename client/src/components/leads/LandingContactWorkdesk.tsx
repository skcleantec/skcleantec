import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  convertLandingContactInquiry,
  getLandingContactInquiries,
  patchLandingContactInquiry,
  type LandingContactInquiry,
  type LandingContactListDatePreset,
} from '../../api/landingContact';
import { listOperatingCompanies, type OperatingCompanyItem } from '../../api/operatingCompanies';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import { formatDateTimeCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { OperatingCompanyBadge } from '../admin/OperatingCompanyBadge';
import {
  LANDING_CONTACT_INQUIRY_STATUSES,
  LANDING_CONTACT_STATUS_LABELS,
  type LandingContactInquiryStatus,
} from '@shared/landingContactForm';
import { SyncHorizontalScroll } from '../ui/SyncHorizontalScroll';
import { useIsLgUp } from '../../hooks/useMediaQuery';
import { ModalCloseButton } from '../admin/ModalCloseButton';

const DATE_PRESETS: { id: LandingContactListDatePreset; label: string }[] = [
  { id: 'last3months', label: '3개월' },
  { id: 'month', label: '월별' },
  { id: 'day', label: '날짜' },
];

export function LandingContactWorkdesk() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLg = useIsLgUp();
  const { scrollToTop, preserveScroll } = useStaffAppScrollPreserve();

  const datePreset = (searchParams.get('datePreset') as LandingContactListDatePreset) || 'last3months';
  const month = searchParams.get('month') ?? kstTodayYmd().slice(0, 7);
  const day = searchParams.get('day') ?? kstTodayYmd();
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));
  const operatingCompanyId = searchParams.get('operatingCompanyId') ?? '';
  const statusFilter = searchParams.get('status') ?? '';

  const [items, setItems] = useState<LandingContactInquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<OperatingCompanyItem[]>([]);
  const [detail, setDetail] = useState<LandingContactInquiry | null>(null);
  const [detailMemo, setDetailMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQuery = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v == null || v === '') next.delete(k);
          else next.set(k, v);
        }
        if (resetPage) next.set('page', '1');
        return next;
      });
      scrollToTop();
    },
    [setSearchParams, scrollToTop],
  );

  const fetchList = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      else preserveScroll();
      try {
        const offset = (page - 1) * pageSize;
        const res = await getLandingContactInquiries(token, {
          datePreset,
          month: datePreset === 'month' ? month : undefined,
          day: datePreset === 'day' ? day : undefined,
          operatingCompanyId: operatingCompanyId || undefined,
          status: (statusFilter as LandingContactInquiryStatus) || undefined,
          limit: pageSize,
          offset,
        });
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      token,
      datePreset,
      month,
      day,
      page,
      pageSize,
      operatingCompanyId,
      statusFilter,
      preserveScroll,
    ],
  );

  useEffect(() => {
    if (!token) return;
    void listOperatingCompanies(token)
      .then((r) => setBrands(r.items.filter((b) => b.isActive)))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    void fetchList(false);
  }, [fetchList]);

  useInboxRealtime(token, () => {
    void fetchList(true);
  }, Boolean(token));

  const openDetail = (row: LandingContactInquiry) => {
    setDetail(row);
    setDetailMemo(row.memo ?? '');
  };

  const handleConvert = async () => {
    if (!token || !detail) return;
    setSaving(true);
    setError(null);
    try {
      const res = await convertLandingContactInquiry(token, detail.id);
      setDetail(res.item);
      await fetchList(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '접수 전환에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!token || !detail) return;
    setSaving(true);
    try {
      const updated = await patchLandingContactInquiry(token, detail.id, { memo: detailMemo });
      setDetail(updated);
      await fetchList(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: LandingContactInquiryStatus) => {
    if (!token || !detail) return;
    setSaving(true);
    try {
      const updated = await patchLandingContactInquiry(token, detail.id, { status });
      setDetail(updated);
      await fetchList(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-sm text-gray-600">
          랜딩·외부 페이지에서 접수된 문의입니다.{' '}
          <Link to="/admin/inquiries/leads/settings" className="font-medium text-sky-700 hover:underline">
            브랜드별 링크·폼 설정
          </Link>
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-fluid-2xs font-medium text-gray-600">접수일</p>
            <div className="inline-flex flex-wrap gap-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateQuery({ datePreset: p.id }, true)}
                  className={`rounded-md border px-3 py-1.5 text-fluid-xs ${
                    datePreset === p.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {datePreset === 'month' ? (
            <YearMonthSelect value={month} onChange={(v) => updateQuery({ month: v }, true)} />
          ) : null}
          {datePreset === 'day' ? <YmdSelect value={day} onChange={(v) => updateQuery({ day: v }, true)} /> : null}
          <div>
            <label className="mb-1 block text-fluid-2xs font-medium text-gray-600">브랜드</label>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5 text-fluid-xs"
              value={operatingCompanyId}
              onChange={(e) => updateQuery({ operatingCompanyId: e.target.value || null }, true)}
            >
              <option value="">전체</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName ?? b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-fluid-2xs font-medium text-gray-600">상태</label>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5 text-fluid-xs"
              value={statusFilter}
              onChange={(e) => updateQuery({ status: e.target.value || null }, true)}
            >
              <option value="">전체</option>
              {LANDING_CONTACT_INQUIRY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LANDING_CONTACT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => updateQuery({ page: String(clampListPage(p, total, pageSize)) })}
          onPageSizeChange={(ps: InquiryListPageSize) =>
            updateQuery({ pageSize: String(ps), page: '1' })
          }
        />

        {error && !detail ? <p className="mb-3 text-fluid-sm text-red-600">{error}</p> : null}

        {shouldShowListBlockingLoading(loading, items.length) ? (
          <p className="py-8 text-center text-fluid-sm text-gray-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-fluid-sm text-gray-500">문의 내역이 없습니다.</p>
        ) : isLg ? (
          <SyncHorizontalScroll>
            <div
              className="-mx-4 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-xs xl:text-fluid-sm">
                <colgroup>
                  <col className="w-[130px]" />
                  <col className="w-[100px]" />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                  <col />
                  <col className="w-[80px]" />
                  <col className="w-[72px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100 text-gray-700">
                    <th className="px-2 py-2 text-center">접수일</th>
                    <th className="px-2 py-2 text-center">브랜드</th>
                    <th className="px-2 py-2 text-center">성함</th>
                    <th className="px-2 py-2 text-center">연락처</th>
                    <th className="px-2 py-2 text-center">문의</th>
                    <th className="px-2 py-2 text-center">상태</th>
                    <th className="px-2 py-2 text-center">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="group border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-2 text-center tabular-nums text-gray-600">
                        {formatDateTimeCompactWithWeekday(row.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <OperatingCompanyBadge company={{ ...row.operatingCompany, name: row.operatingCompany.displayName || row.operatingCompany.name }} />
                      </td>
                      <td className="truncate px-2 py-2 text-center" title={row.customerName}>
                        {row.customerName}
                      </td>
                      <td className="truncate px-2 py-2 text-center tabular-nums" title={row.customerPhone}>
                        {row.customerPhone}
                      </td>
                      <td className="truncate px-2 py-2 text-center" title={row.content}>
                        {row.content}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {LANDING_CONTACT_STATUS_LABELS[row.status]}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => openDetail(row)}
                          className="rounded border border-gray-300 px-2 py-1 text-fluid-2xs hover:bg-white"
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SyncHorizontalScroll>
        ) : (
          <div className="space-y-3 lg:hidden">
            {items.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openDetail(row)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-left hover:bg-gray-50"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <OperatingCompanyBadge company={{ ...row.operatingCompany, name: row.operatingCompany.displayName || row.operatingCompany.name }} />
                  <span className="text-fluid-2xs text-gray-500">
                    {formatDateTimeCompactWithWeekday(row.createdAt)}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{row.customerName}</p>
                <p className="text-fluid-xs tabular-nums text-gray-600">{row.customerPhone}</p>
                <p className="mt-1 line-clamp-2 text-fluid-xs text-gray-700">{row.content}</p>
                <p className="mt-2 text-fluid-2xs font-medium text-sky-800">
                  {LANDING_CONTACT_STATUS_LABELS[row.status]}
                </p>
              </button>
            ))}
          </div>
        )}

        {!loading ? (
          <ListPaginationBar
            mode="nav"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => updateQuery({ page: String(clampListPage(p, total, pageSize)) })}
            onPageSizeChange={(ps: InquiryListPageSize) =>
              updateQuery({ pageSize: String(ps), page: '1' })
            }
          />
        ) : null}
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">문의 상세</h2>
                <div className="mt-1">
                  <OperatingCompanyBadge company={{ ...detail.operatingCompany, name: detail.operatingCompany.displayName || detail.operatingCompany.name }} />
                </div>
              </div>
              <ModalCloseButton onClick={() => setDetail(null)} />
            </div>
            <dl className="space-y-3 text-fluid-sm">
              <div>
                <dt className="text-fluid-2xs text-gray-500">접수일</dt>
                <dd>{formatDateTimeCompactWithWeekday(detail.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-fluid-2xs text-gray-500">성함 / 연락처</dt>
                <dd>
                  {detail.customerName} · {detail.customerPhone}
                </dd>
              </div>
              <div>
                <dt className="text-fluid-2xs text-gray-500">문의 내용</dt>
                <dd className="whitespace-pre-wrap">{detail.content}</dd>
              </div>
              {Object.entries(detail.customFieldValues ?? {}).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-fluid-2xs text-gray-500">{k}</dt>
                  <dd className="whitespace-pre-wrap">{v}</dd>
                </div>
              ))}
              {detail.sourcePageUrl ? (
                <div>
                  <dt className="text-fluid-2xs text-gray-500">유입 페이지</dt>
                  <dd className="break-all text-sky-800">{detail.sourcePageUrl}</dd>
                </div>
              ) : null}
              <div>
                <dt className="mb-1 text-fluid-2xs text-gray-500">내부 메모</dt>
                <dd>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
                    rows={3}
                    value={detailMemo}
                    onChange={(e) => setDetailMemo(e.target.value)}
                  />
                </dd>
              </div>
            </dl>
            {error ? <p className="mt-3 text-fluid-sm text-red-600">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {LANDING_CONTACT_INQUIRY_STATUSES.filter((s) => s !== 'CONVERTED' || detail.inquiry).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={saving || detail.status === s}
                    onClick={() => void handleStatusChange(s)}
                    className={`rounded-md border px-3 py-1.5 text-fluid-xs ${
                      detail.status === s
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {LANDING_CONTACT_STATUS_LABELS[s]}
                  </button>
                ),
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveDetail()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                메모 저장
              </button>
              {!detail.inquiry ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConvert()}
                  className="rounded-lg border border-sky-600 bg-sky-50 px-4 py-2 text-fluid-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
                >
                  접수로 전환
                </button>
              ) : (
                <Link
                  to={`/admin/inquiries?open=${detail.inquiry.id}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  접수 #{detail.inquiry.inquiryNumber ?? detail.inquiry.id.slice(0, 8)} 보기
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
