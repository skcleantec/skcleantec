import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { getToken } from '../../stores/auth';
import {
  deleteInquiryExcelRunInquiries,
  getInquiryExcelRun,
  listInquiryExcelRuns,
  type InquiryExcelRunDetail,
  type InquiryExcelRunSummary,
} from '../../api/inquiryExcelImport';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

const ACTION_LABEL: Record<string, string> = {
  CREATED: '등록됨',
  DELETED: '삭제됨',
  SKIPPED: '건너뜀',
  ERROR: '오류',
};

function actionClass(action: string): string {
  if (action === 'CREATED') return 'bg-emerald-100 text-emerald-800';
  if (action === 'DELETED') return 'bg-slate-200 text-slate-700';
  if (action === 'SKIPPED') return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

function formatRunAt(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RunSummaryCells({ run }: { run: InquiryExcelRunSummary }) {
  return (
    <>
      <td className="border border-slate-200 px-2 py-2 text-center whitespace-nowrap">{formatRunAt(run.createdAt)}</td>
      <td className="border border-slate-200 px-2 py-2 text-center truncate" title={run.fileName ?? ''}>
        {run.fileName ?? '—'}
      </td>
      <td className="border border-slate-200 px-2 py-2 text-center truncate" title={run.profile?.name ?? ''}>
        {run.profile?.name ?? '—'}
      </td>
      <td className="border border-slate-200 px-2 py-2 text-center">{run.actor?.name ?? '—'}</td>
      <td className="border border-slate-200 px-2 py-2 text-center tabular-nums">{run.totalRows}</td>
      <td className="border border-slate-200 px-2 py-2 text-center tabular-nums text-emerald-700">{run.createdCount}</td>
      <td className="border border-slate-200 px-2 py-2 text-center tabular-nums text-amber-700">{run.skippedCount}</td>
      <td className="border border-slate-200 px-2 py-2 text-center tabular-nums text-red-700">{run.errorCount}</td>
      <td className="border border-slate-200 px-2 py-2 text-center tabular-nums">
        {run.deletedCount > 0 ? (
          <span className="text-slate-600">{run.deletedCount}건 삭제</span>
        ) : run.remainingCreatedCount > 0 ? (
          <span className="text-emerald-700">{run.remainingCreatedCount}건 유지</span>
        ) : (
          '—'
        )}
      </td>
    </>
  );
}

export function AdminInquiryExcelHistoryPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get('runId') ?? '';
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const [items, setItems] = useState<InquiryExcelRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<InquiryExcelRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const offset = (page - 1) * pageSize;

  const loadList = useCallback(async () => {
    if (!token) return;
    const data = await listInquiryExcelRuns(token, { limit: pageSize, offset });
    setItems(data.items);
    setTotal(data.total);
  }, [token, pageSize, offset]);

  const loadDetail = useCallback(async () => {
    if (!token || !runId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      setDetail(await getInquiryExcelRun(token, runId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '상세 불러오기 실패');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [token, runId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    loadList()
      .catch((e) => setError(e instanceof Error ? e.message : '목록 불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token, loadList]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const setPage = (next: number) => {
    const p = clampListPage(next, total, pageSize);
    const nextParams = new URLSearchParams(searchParams);
    if (p <= 1) nextParams.delete('page');
    else nextParams.set('page', String(p));
    setSearchParams(nextParams);
  };

  const setPageSize = (size: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('page');
    nextParams.set('pageSize', String(size));
    setSearchParams(nextParams);
  };

  const selectRun = (id: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('runId', id);
    setSearchParams(nextParams);
  };

  const canBulkDelete = (detail?.remainingCreatedCount ?? 0) > 0;

  const handleBulkDelete = async (password: string) => {
    if (!token || !runId) return;
    const result = await deleteInquiryExcelRunInquiries(token, runId, password);
    setMessage(`${result.deletedCount}건 접수를 삭제했습니다.`);
    await Promise.all([loadList(), loadDetail()]);
  };

  const detailRows = detail?.rowResults ?? [];

  const selectedSummary = useMemo(
    () => items.find((r) => r.id === runId) ?? null,
    [items, runId],
  );

  if (loading && items.length === 0) {
    return <p className="p-6 text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-fluid-lg font-semibold text-slate-900">실행 이력</h1>
        <p className="mt-1 text-fluid-sm text-slate-600">
          엑셀 일괄 등록 실행 기록입니다. 행을 선택하면 등록·건너뜀·오류 상세를 볼 수 있습니다.
        </p>
        <p className="mt-2 text-fluid-xs text-slate-500">
          <Link to="/admin/inquiries/bulk-excel/import" className="text-sky-700 underline">
            일괄 등록
          </Link>
          {' · '}
          <Link to="/admin/inquiries/bulk-excel/mappings" className="text-sky-700 underline">
            매칭 서식
          </Link>
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <ListPaginationBar
          mode="summary"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        <div className="hidden lg:block w-full min-w-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[960px] table-fixed border-collapse text-fluid-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-200 px-2 py-2 text-center w-36">실행일시</th>
                <th className="border border-slate-200 px-2 py-2 text-center">파일명</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-28">서식</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-20">실행자</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-14">총</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-14">등록</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-14">건너뜀</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-14">오류</th>
                <th className="border border-slate-200 px-2 py-2 text-center w-24">접수 상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((run) => (
                <tr
                  key={run.id}
                  className={`cursor-pointer hover:bg-slate-50 ${runId === run.id ? 'bg-sky-50' : ''}`}
                  onClick={() => selectRun(run.id)}
                >
                  <RunSummaryCells run={run} />
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-slate-200 px-4 py-10 text-center text-fluid-sm text-slate-500">
                    실행 이력이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="lg:hidden divide-y divide-slate-100">
          {items.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => selectRun(run.id)}
              className={`w-full p-3 text-left text-fluid-xs ${runId === run.id ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
            >
              <p className="font-medium text-slate-900">{formatRunAt(run.createdAt)}</p>
              <p className="mt-1 truncate text-slate-700">{run.fileName ?? '파일명 없음'}</p>
              <p className="mt-1 text-slate-600">
                {run.profile?.name ?? '서식 없음'} · 등록 {run.createdCount} · 건너뜀 {run.skippedCount} · 오류{' '}
                {run.errorCount}
              </p>
            </button>
          ))}
          {items.length === 0 ? (
            <p className="p-6 text-center text-fluid-sm text-slate-500">실행 이력이 없습니다.</p>
          ) : null}
        </div>
        {!loading ? (
          <ListPaginationBar
            mode="nav"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>

      {runId ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-fluid-sm font-semibold text-slate-900">실행 상세</h2>
              {selectedSummary || detail ? (
                <p className="mt-1 text-fluid-xs text-slate-600">
                  {formatRunAt((detail ?? selectedSummary)!.createdAt)} · {(detail ?? selectedSummary)!.fileName ?? '파일명 없음'}
                  {(detail ?? selectedSummary)!.profile?.name ? ` · ${(detail ?? selectedSummary)!.profile!.name}` : ''}
                </p>
              ) : null}
            </div>
            {canBulkDelete ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="rounded-xl border border-red-300 px-4 py-2 text-fluid-sm text-red-700 hover:bg-red-50"
              >
                이 실행으로 등록한 접수 일괄 삭제 ({detail?.remainingCreatedCount ?? 0}건)
              </button>
            ) : detail && detail.createdCount > 0 ? (
              <p className="text-fluid-xs text-slate-500">등록된 접수는 모두 삭제되었거나 개별 삭제된 상태입니다.</p>
            ) : null}
          </div>

          {detailLoading ? (
            <p className="text-fluid-sm text-slate-500">상세 불러오는 중…</p>
          ) : detailRows.length > 0 ? (
            <>
              <p className="text-fluid-xs text-slate-600">
                등록 {detail?.createdCount ?? 0} · 건너뜀 {detail?.skippedCount ?? 0} · 오류 {detail?.errorCount ?? 0}
                {(detail?.deletedCount ?? 0) > 0 ? ` · 삭제됨 ${detail!.deletedCount}` : ''}
              </p>
              <div className="hidden lg:block w-full min-w-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-fluid-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-200 px-2 py-2 text-center w-16">행</th>
                      <th className="border border-slate-200 px-2 py-2 text-center w-24">결과</th>
                      <th className="border border-slate-200 px-2 py-2 text-center">접수번호</th>
                      <th className="border border-slate-200 px-2 py-2 text-center">메시지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-2 py-2 text-center tabular-nums">{row.rowIndex}</td>
                        <td className="border border-slate-200 px-2 py-2 text-center">
                          <span className={`inline-block rounded px-1.5 py-0.5 ${actionClass(row.kind)}`}>
                            {ACTION_LABEL[row.kind] ?? row.kind}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center truncate">
                          {row.inquiryNumber ? `#${row.inquiryNumber}` : '—'}
                        </td>
                        <td className="border border-slate-200 px-2 py-2 text-center truncate" title={row.message ?? ''}>
                          {row.message ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="lg:hidden divide-y divide-slate-100 border border-slate-100 rounded-lg">
                {detailRows.map((row, i) => (
                  <div key={i} className="p-3 text-fluid-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{row.rowIndex}행</span>
                      <span className={`rounded px-1.5 py-0.5 ${actionClass(row.kind)}`}>
                        {ACTION_LABEL[row.kind] ?? row.kind}
                      </span>
                    </div>
                    {row.inquiryNumber ? <p className="mt-1 text-slate-700">#{row.inquiryNumber}</p> : null}
                    {row.message ? <p className="mt-1 text-slate-500">{row.message}</p> : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-fluid-sm text-slate-500">행 결과가 없습니다.</p>
          )}
        </div>
      ) : null}

      <ConfirmPasswordModal
        open={deleteOpen}
        title="일괄 등록 접수 삭제"
        confirmLabel="일괄 삭제"
        description={
          <>
            이 실행으로 등록된 접수 <strong>{detail?.remainingCreatedCount ?? 0}건</strong>을 영구 삭제합니다.
            배정·사진 등 연결 데이터도 함께 제거됩니다. 되돌릴 수 없습니다.
          </>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
