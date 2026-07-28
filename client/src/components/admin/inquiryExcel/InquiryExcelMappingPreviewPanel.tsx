import { useMemo, useState } from 'react';
import { INQUIRY_EXCEL_STATUS_LABELS } from '@shared/inquiryExcelImportFields';
import type { InquiryExcelPreviewResponse } from '../../../api/inquiryExcelImport';

const ACTION_LABEL: Record<string, string> = {
  CREATE: '등록',
  SKIP: '건너뜀',
  ERROR: '오류',
};

function actionClass(action: string): string {
  if (action === 'CREATE') return 'bg-emerald-100 text-emerald-800';
  if (action === 'SKIP') return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

type Props = {
  preview: InquiryExcelPreviewResponse | null;
  loading: boolean;
  canPreview: boolean;
  onPreview: () => void;
  onScrollToColumnSection?: () => void;
};

export function InquiryExcelMappingPreviewPanel({
  preview,
  loading,
  canPreview,
  onPreview,
  onScrollToColumnSection,
}: Props) {
  const [errorsOnly, setErrorsOnly] = useState(true);

  const rows = preview?.preview ?? [];
  const filteredRows = useMemo(
    () => (errorsOnly ? rows.filter((r) => r.action === 'ERROR') : rows),
    [rows, errorsOnly],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-fluid-sm font-semibold text-slate-800">미리보기</h2>
          <p className="mt-1 text-fluid-2xs text-slate-500">
            저장 전에도 현재 연결 규칙으로 결과를 확인할 수 있습니다. (샘플 파일 필요)
          </p>
        </div>
        <button
          type="button"
          disabled={loading || !canPreview}
          onClick={onPreview}
          className="rounded-xl border border-slate-300 px-4 py-2 text-fluid-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? '확인 중…' : '미리보기 실행'}
        </button>
      </div>

      {!canPreview ? (
        <p className="text-fluid-2xs text-slate-500">
          미리보기: 서식을 저장한 뒤, 위에서 선택한 샘플 엑셀과 함께 실행하세요.
        </p>
      ) : null}

      {preview ? (
        <>
          <p className="text-fluid-sm text-slate-800">
            총 <span className="font-semibold tabular-nums">{preview.totalRows}</span>행 · 등록{' '}
            <span className="font-semibold tabular-nums text-emerald-700">{preview.createdCount}</span> · 건너뜀{' '}
            <span className="font-semibold tabular-nums text-amber-700">{preview.skippedCount}</span> · 오류{' '}
            <span className="font-semibold tabular-nums text-red-700">{preview.errorCount}</span>
          </p>
          {preview.errorCount > 0 ? (
            <label className="inline-flex items-center gap-2 text-fluid-2xs text-slate-600">
              <input
                type="checkbox"
                checked={errorsOnly}
                onChange={(e) => setErrorsOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              오류 행만 보기
            </label>
          ) : null}
          {filteredRows.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-fluid-2xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 px-2 py-1.5 text-center w-12">행</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center w-16">결과</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">성함</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center">메시지</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const statusKey = row.mapped?.status != null ? String(row.mapped.status) : '';
                    const msg =
                      row.message ??
                      (statusKey ? INQUIRY_EXCEL_STATUS_LABELS[statusKey] ?? statusKey : '');
                    return (
                      <tr key={row.rowIndex} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums">
                          {row.rowIndex}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center">
                          <span className={`inline-block rounded px-1 py-0.5 ${actionClass(row.action)}`}>
                            {ACTION_LABEL[row.action] ?? row.action}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center truncate">
                          {String(row.mapped?.customerName ?? '—')}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center">
                          <span className="truncate" title={msg}>
                            {msg || '—'}
                          </span>
                          {row.action === 'ERROR' && onScrollToColumnSection ? (
                            <button
                              type="button"
                              onClick={onScrollToColumnSection}
                              className="ml-1 text-sky-700 underline"
                            >
                              열 연결
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-fluid-2xs text-slate-500">표시할 행이 없습니다.</p>
          )}
        </>
      ) : null}
    </div>
  );
}
