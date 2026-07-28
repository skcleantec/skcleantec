import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { InquiryExcelMappingSpec } from '@shared/inquiryExcelImportPolicy';
import {
  filterExcelHeadersForView,
  getFieldKeyForHeader,
  getHeaderForFieldKey,
  INQUIRY_EXCEL_REQUIRED_FIELD_KEYS,
  setFieldHeaderMapping,
  setHeaderFieldMapping,
  type ExcelColumnFilter,
} from '../../../utils/inquiryExcelMappingUi';
import { InquiryExcelFieldHint, InquiryExcelFieldSelect } from './InquiryExcelFieldSelect';

type Props = {
  spec: InquiryExcelMappingSpec;
  excelHeaders: string[];
  headerSamples: Record<string, string[]>;
  memoLineHeaders: string[];
  columnFilter: ExcelColumnFilter;
  headerSearch: string;
  onSpecChange: (next: InquiryExcelMappingSpec) => void;
  onColumnFilterChange: (filter: ExcelColumnFilter) => void;
  onHeaderSearchChange: (q: string) => void;
  scrollToHeaderRef?: MutableRefObject<(header: string) => void>;
};

const FILTER_OPTIONS: { value: ExcelColumnFilter; label: string }[] = [
  { value: 'unmapped', label: '미연결 열' },
  { value: 'mapped', label: '연결됨' },
  { value: 'required', label: '필수 필드' },
  { value: 'all', label: '전체' },
];

function formatSamples(samples: string[] | undefined): string {
  if (!samples?.length) return '—';
  return samples.map((s) => (s.length > 24 ? `${s.slice(0, 24)}…` : s)).join(' · ');
}

export function InquiryExcelMappingColumnSection({
  spec,
  excelHeaders,
  headerSamples,
  memoLineHeaders,
  columnFilter,
  headerSearch,
  onSpecChange,
  onColumnFilterChange,
  onHeaderSearchChange,
  scrollToHeaderRef,
}: Props) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!scrollToHeaderRef) return;
    scrollToHeaderRef.current = (header: string) => {
      const el = cardRefs.current[header];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-sky-400');
        window.setTimeout(() => el.classList.remove('ring-2', 'ring-sky-400'), 2000);
      }
    };
  }, [scrollToHeaderRef]);

  const memoSet = useMemo(() => new Set(memoLineHeaders.filter(Boolean)), [memoLineHeaders]);

  const mappedFieldKeys = useMemo(
    () => new Set(spec.columnMappings.map((m) => m.fieldKey)),
    [spec.columnMappings],
  );

  const filteredHeaders = useMemo(() => {
    const base = filterExcelHeadersForView(excelHeaders, spec, memoLineHeaders, columnFilter);
    const q = headerSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((h) => h.toLowerCase().includes(q));
  }, [excelHeaders, spec, memoLineHeaders, columnFilter, headerSearch]);

  const setHeaderField = (excelHeader: string, fieldKey: string) => {
    onSpecChange(setHeaderFieldMapping(spec, excelHeader, fieldKey));
  };

  const setRequiredField = (fieldKey: string, excelHeader: string) => {
    onSpecChange(setFieldHeaderMapping(spec, fieldKey, excelHeader));
  };

  const headerOptions = (selected: string) => {
    if (selected && !excelHeaders.includes(selected)) return [selected, ...excelHeaders];
    return excelHeaders;
  };

  if (excelHeaders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-fluid-sm text-slate-600">샘플 엑셀을 업로드하면 열 목록이 표시됩니다.</p>
        <p className="mt-1 text-fluid-2xs text-slate-500">저장된 서식이면 마지막 샘플 헤더가 자동으로 복원됩니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div>
        <h2 className="text-fluid-sm font-semibold text-slate-800">열 연결</h2>
        <p className="mt-1 text-fluid-2xs text-slate-500">
          엑셀 열마다 청소비서 필드를 직접 고릅니다. 예시 값으로 열 내용을 확인하세요.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
        <p className="text-fluid-2xs font-medium text-amber-900">필수 3항목</p>
        {INQUIRY_EXCEL_REQUIRED_FIELD_KEYS.map((fieldKey) => {
          const selectedHeader = getHeaderForFieldKey(spec, fieldKey);
          const label =
            fieldKey === 'customerName' ? '성함' : fieldKey === 'customerPhone' ? '연락처' : '주소';
          return (
            <label key={fieldKey} className="block text-fluid-xs text-slate-700">
              <span className="font-medium">
                {label}
                <span className="text-red-500"> *</span>
              </span>
              <select
                value={selectedHeader}
                onChange={(e) => setRequiredField(fieldKey, e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-fluid-xs"
              >
                <option value="">— 엑셀 열 선택 —</option>
                {headerOptions(selectedHeader)
                  .filter((h) => !memoSet.has(h) || h === selectedHeader)
                  .map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
              </select>
              <InquiryExcelFieldHint fieldKey={fieldKey} />
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onColumnFilterChange(opt.value)}
              className={`rounded-md px-2.5 py-1 text-fluid-2xs font-medium ${
                columnFilter === opt.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={headerSearch}
          onChange={(e) => onHeaderSearchChange(e.target.value)}
          placeholder="열 이름 검색"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-fluid-xs sm:max-w-xs"
        />
      </div>

      {memoSet.size > 0 ? (
        <p className="text-fluid-2xs text-slate-500">
          줄 합치기에 쓰는 열({[...memoSet].join(', ')})은 아래 목록에서 제외됩니다.
        </p>
      ) : null}

      {filteredHeaders.length === 0 ? (
        <p className="py-4 text-center text-fluid-xs text-slate-500">표시할 열이 없습니다. 필터를 바꿔 보세요.</p>
      ) : (
        <div className="space-y-2">
          {filteredHeaders.map((header) => {
            const fieldKey = getFieldKeyForHeader(spec, header);
            const samples = headerSamples[header] ?? spec.headerSamples?.[header];
            const disabledFieldKeys = new Set(mappedFieldKeys);
            if (fieldKey) disabledFieldKeys.delete(fieldKey);
            return (
              <div
                key={header}
                ref={(el) => {
                  cardRefs.current[header] = el;
                }}
                className="rounded-xl border border-slate-200 p-3 transition-shadow"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fluid-xs text-slate-900" title={header}>
                      {header}
                    </p>
                    <p className="mt-0.5 text-fluid-2xs text-slate-500" title={samples?.join(' / ')}>
                      예: {formatSamples(samples)}
                    </p>
                  </div>
                  <div className="w-full sm:max-w-xs shrink-0">
                    <InquiryExcelFieldSelect
                      value={fieldKey}
                      onChange={(next) => setHeaderField(header, next)}
                      disabledFieldKeys={disabledFieldKeys}
                    />
                    {fieldKey ? <InquiryExcelFieldHint fieldKey={fieldKey} /> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
