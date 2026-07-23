import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { Link, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { INQUIRY_EXCEL_IMPORT_MAX_FILE_BYTES, INQUIRY_EXCEL_IMPORT_MAX_ROWS } from '@shared/inquiryExcelImportPolicy';
import { INQUIRY_EXCEL_STATUS_LABELS } from '@shared/inquiryExcelImportFields';
import {
  executeInquiryExcelImport,
  listInquiryExcelProfiles,
  previewInquiryExcelImport,
  type InquiryExcelExecuteResponse,
  type InquiryExcelPreviewResponse,
  type InquiryExcelProfile,
} from '../../api/inquiryExcelImport';

const ACTION_LABEL: Record<string, string> = {
  CREATE: '등록',
  SKIP: '건너뜀',
  ERROR: '오류',
  CREATED: '등록됨',
  SKIPPED: '건너뜀',
  DELETED: '삭제됨',
};

function actionClass(action: string): string {
  if (action === 'CREATE' || action === 'CREATED') return 'bg-emerald-100 text-emerald-800';
  if (action === 'SKIP' || action === 'SKIPPED') return 'bg-amber-100 text-amber-900';
  if (action === 'DELETED') return 'bg-slate-200 text-slate-700';
  return 'bg-red-100 text-red-800';
}

export function AdminInquiryExcelImportPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileId = searchParams.get('profileId') ?? '';

  const [profiles, setProfiles] = useState<InquiryExcelProfile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<InquiryExcelPreviewResponse | null>(null);
  const [result, setResult] = useState<InquiryExcelExecuteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId) ?? null,
    [profiles, profileId],
  );

  const loadProfiles = useCallback(async () => {
    if (!token) return;
    const { items } = await listInquiryExcelProfiles(token);
    setProfiles(items);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadProfiles()
      .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token, loadProfiles]);

  const handlePreview = async () => {
    if (!token || !profileId || !file) {
      setError('매칭 서식과 엑셀 파일을 선택해주세요.');
      return;
    }
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      const data = await previewInquiryExcelImport(token, profileId, file);
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기 실패');
    } finally {
      setWorking(false);
    }
  };

  const handleExecute = async () => {
    if (!token || !profileId || !file) {
      setError('매칭 서식과 엑셀 파일을 선택해주세요.');
      return;
    }
    if (!window.confirm('미리보기 결과대로 접수를 일괄 등록할까요?')) return;
    setWorking(true);
    setError(null);
    try {
      const data = await executeInquiryExcelImport(token, profileId, file);
      setResult(data);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '일괄 등록 실패');
    } finally {
      setWorking(false);
    }
  };

  const rows = result?.rows ?? preview?.preview ?? [];
  const summary = result ?? preview;

  if (loading) {
    return <p className="p-6 text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <PageTitleWithFavorite label="일괄 등록">
          <h1 className="text-fluid-lg font-semibold text-slate-900">일괄 등록</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-fluid-sm text-slate-600">
          저장된 매칭 서식으로 엑셀을 업로드해 접수를 등록합니다. (
          {INQUIRY_EXCEL_IMPORT_MAX_ROWS > 0
            ? `최대 ${INQUIRY_EXCEL_IMPORT_MAX_ROWS}행/회`
            : `행 수 제한 없음 · 파일 최대 ${Math.round(INQUIRY_EXCEL_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}MB`}
          )
        </p>
        <p className="mt-2 text-fluid-xs text-slate-500">
          <Link to="/admin/inquiries/bulk-excel/mappings" className="text-sky-700 underline">
            매칭 서식 관리
          </Link>
          {' · '}
          <Link to="/admin/inquiries/bulk-excel/history" className="text-sky-700 underline">
            실행 이력
          </Link>
          에서 과거 일괄 등록·일괄 삭제를 확인할 수 있습니다.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <label className="block text-fluid-sm font-medium text-slate-700">
          매칭 서식
          <select
            value={profileId}
            onChange={(e) => {
              const id = e.target.value;
              setSearchParams(id ? { profileId: id } : {});
              setPreview(null);
              setResult(null);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-fluid-sm"
          >
            <option value="">— 선택 —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {selectedProfile ? (
          <p className="text-fluid-2xs text-slate-500">
            열 매핑 {selectedProfile.mappingSpec.columnMappings?.length ?? 0}개 · 값 매핑 그룹{' '}
            {selectedProfile.mappingSpec.valueMappings?.length ?? 0}개
          </p>
        ) : null}

        <label className="block text-fluid-sm font-medium text-slate-700">
          엑셀 파일
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="mt-1 block w-full text-fluid-xs"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
            }}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={working || !profileId || !file}
            onClick={() => void handlePreview()}
            className="rounded-xl border border-slate-300 px-4 py-2 text-fluid-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {working ? '처리 중…' : '미리보기'}
          </button>
          <button
            type="button"
            disabled={working || !profileId || !file}
            onClick={() => void handleExecute()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            일괄 등록 실행
          </button>
        </div>
      </div>

      {summary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-fluid-sm text-slate-800">
            총 <span className="font-semibold tabular-nums">{summary.totalRows}</span>행 · 등록{' '}
            <span className="font-semibold tabular-nums text-emerald-700">{summary.createdCount}</span> · 건너뜀{' '}
            <span className="font-semibold tabular-nums text-amber-700">{summary.skippedCount}</span> · 오류{' '}
            <span className="font-semibold tabular-nums text-red-700">{summary.errorCount}</span>
          </p>
          {'runId' in summary && summary.runId ? (
            <p className="mt-1 text-fluid-2xs text-slate-500">
              <Link
                to={`/admin/inquiries/bulk-excel/history?runId=${summary.runId}`}
                className="text-sky-700 underline"
              >
                실행 이력에서 보기
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="hidden lg:block w-full min-w-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-fluid-xs">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-2 py-2 text-center w-16">행</th>
                  <th className="border border-slate-200 px-2 py-2 text-center w-24">결과</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">성함</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">연락처</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">상태</th>
                  <th className="border border-slate-200 px-2 py-2 text-center">메시지</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const action = 'action' in row ? row.action : row.kind;
                  const mapped = 'mapped' in row ? row.mapped : undefined;
                  const statusKey = mapped?.status != null ? String(mapped.status) : '';
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-2 text-center tabular-nums">{row.rowIndex}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <span className={`inline-block rounded px-1.5 py-0.5 ${actionClass(action)}`}>
                          {ACTION_LABEL[action] ?? action}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center truncate" title={String(mapped?.customerName ?? '')}>
                        {String(mapped?.customerName ?? '—')}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center truncate">{String(mapped?.customerPhone ?? '—')}</td>
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        {statusKey ? INQUIRY_EXCEL_STATUS_LABELS[statusKey] ?? statusKey : '—'}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center truncate" title={row.message ?? ''}>
                        {row.message ?? ('inquiryNumber' in row && row.inquiryNumber ? `#${row.inquiryNumber}` : '—')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="lg:hidden divide-y divide-slate-100">
            {rows.map((row, i) => {
              const action = 'action' in row ? row.action : row.kind;
              const mapped = 'mapped' in row ? row.mapped : undefined;
              return (
                <div key={i} className="p-3 text-fluid-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{row.rowIndex}행</span>
                    <span className={`rounded px-1.5 py-0.5 ${actionClass(action)}`}>{ACTION_LABEL[action] ?? action}</span>
                  </div>
                  <p className="mt-1 text-slate-700">
                    {String(mapped?.customerName ?? '')} · {String(mapped?.customerPhone ?? '')}
                  </p>
                  {row.message ? <p className="mt-1 text-slate-500">{row.message}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
