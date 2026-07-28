import { useState } from 'react';
import {
  INQUIRY_EXCEL_AREA_BASIS_VALUES,
  INQUIRY_EXCEL_DEFAULT_AREA_BASIS,
  INQUIRY_EXCEL_STATUS_LABELS,
  INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS,
} from '@shared/inquiryExcelImportFields';
import type { InquiryExcelFieldCatalog } from '../../../api/inquiryExcelImport';
import type { InquiryExcelMappingSpec } from '@shared/inquiryExcelImportPolicy';

type Props = {
  spec: InquiryExcelMappingSpec;
  excelHeaders: string[];
  catalog: InquiryExcelFieldCatalog | null;
  fieldOptions: Array<{ key: string; label: string; hint?: string }>;
  onSpecChange: (next: InquiryExcelMappingSpec) => void;
};

function headerSelectOptions(excelHeaders: string[], selected: string): string[] {
  if (selected && !excelHeaders.includes(selected)) return [selected, ...excelHeaders];
  return excelHeaders;
}

export function InquiryExcelMappingAdvancedSection({
  spec,
  excelHeaders,
  catalog,
  fieldOptions,
  onSpecChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const memoLineGroup = spec.memoLineMappings?.[0] ?? { targetFieldKey: 'specialNotes' as const, excelHeaders: [] };
  const memoLineHeaders = memoLineGroup.excelHeaders ?? [];

  const patchMemoLineGroup = (patch: Partial<{ targetFieldKey: 'specialNotes' | 'memo'; excelHeaders: string[] }>) => {
    const cur = spec.memoLineMappings?.[0] ?? { targetFieldKey: 'specialNotes' as const, excelHeaders: [] };
    onSpecChange({
      ...spec,
      memoLineMappings: [{ ...cur, ...patch }],
    });
  };

  const addValueEntry = (fieldKey: string) => {
    const vm = spec.valueMappings.find((v) => v.fieldKey === fieldKey);
    if (vm) {
      onSpecChange({
        ...spec,
        valueMappings: spec.valueMappings.map((v) =>
          v.fieldKey === fieldKey ? { ...v, entries: [...v.entries, { excelValue: '', skValue: '' }] } : v,
        ),
      });
      return;
    }
    onSpecChange({
      ...spec,
      valueMappings: [...spec.valueMappings, { fieldKey, entries: [{ excelValue: '', skValue: '' }] }],
    });
  };

  const updateValueEntry = (
    fieldKey: string,
    index: number,
    patch: Partial<{ excelValue: string; skValue: string }>,
  ) => {
    onSpecChange({
      ...spec,
      valueMappings: spec.valueMappings.map((v) =>
        v.fieldKey === fieldKey
          ? { ...v, entries: v.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)) }
          : v,
      ),
    });
  };

  const removeValueEntry = (fieldKey: string, index: number) => {
    onSpecChange({
      ...spec,
      valueMappings: spec.valueMappings
        .map((v) =>
          v.fieldKey === fieldKey ? { ...v, entries: v.entries.filter((_, i) => i !== index) } : v,
        )
        .filter((v) => v.entries.length > 0),
    });
  };

  const skOptionsForField = (fieldKey: string): { value: string; label: string }[] => {
    if (fieldKey === 'status') {
      return Object.entries(INQUIRY_EXCEL_STATUS_LABELS).map(([value, label]) => ({ value, label }));
    }
    if (fieldKey === 'operatingCompanyId') {
      return (catalog?.operatingCompanies ?? []).map((oc) => ({
        value: oc.id,
        label: oc.displayName ? `${oc.name} (${oc.displayName})` : oc.name,
      }));
    }
    if (fieldKey === 'preferredTime') {
      return (
        catalog?.timeSlotOptions ?? [
          { value: '오전', label: '오전 (8시~9시 시작)' },
          { value: '오후', label: '오후 (12시~14시 시작)' },
          { value: '사이청소', label: '사이청소' },
        ]
      );
    }
    if (fieldKey === 'buildingType') {
      return [
        { value: '신축', label: '신축' },
        { value: '구축', label: '구축' },
        { value: '인테리어', label: '인테리어' },
        { value: '거주(짐이있는상태)', label: '거주(짐이있는상태)' },
      ];
    }
    return [];
  };

  const valueMappingCount = spec.valueMappings.reduce((n, v) => n + v.entries.length, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-fluid-sm font-semibold text-slate-800">고급 설정</span>
        <span className="text-fluid-2xs text-slate-500">
          값 변환 {valueMappingCount}건 · 줄 합치기 {memoLineHeaders.filter(Boolean).length}줄
          <span className="ml-2 text-slate-400">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-fluid-sm font-semibold text-slate-800">값 변환</h3>
                <p className="mt-1 text-fluid-2xs text-slate-500">
                  엑셀에 적힌 글자를 청소비서 값으로 바꿉니다. 시간대(오전·오후·사이)는 대부분 자동 인식되므로 예외만
                  추가하세요.
                </p>
              </div>
            </div>
            {INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS.map((fieldKey) => {
              const fieldDef = fieldOptions.find((f) => f.key === fieldKey);
              const vm = spec.valueMappings.find((v) => v.fieldKey === fieldKey);
              const entries = vm?.entries ?? [];
              const skOpts = skOptionsForField(fieldKey);
              if (skOpts.length === 0 && fieldKey !== 'source' && fieldKey !== 'propertyType') return null;
              return (
                <div key={fieldKey} className="mt-3 rounded-lg border border-slate-100 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-fluid-xs font-medium text-slate-800">{fieldDef?.label ?? fieldKey}</p>
                    <button
                      type="button"
                      onClick={() => addValueEntry(fieldKey)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-fluid-2xs hover:bg-slate-50"
                    >
                      + 규칙 추가
                    </button>
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-fluid-2xs text-slate-500">규칙 없음</p>
                  ) : (
                    <div className="space-y-2">
                      {entries.map((entry, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2">
                          <input
                            value={entry.excelValue}
                            onChange={(e) => updateValueEntry(fieldKey, idx, { excelValue: e.target.value })}
                            placeholder="엑셀 값"
                            className="min-w-[7rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                          />
                          <span className="text-slate-400">→</span>
                          {skOpts.length > 0 ? (
                            <select
                              value={entry.skValue}
                              onChange={(e) => updateValueEntry(fieldKey, idx, { skValue: e.target.value })}
                              className="min-w-[7rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                            >
                              <option value="">청소비서 값</option>
                              {skOpts.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={entry.skValue}
                              onChange={(e) => updateValueEntry(fieldKey, idx, { skValue: e.target.value })}
                              placeholder="청소비서 값"
                              className="min-w-[7rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeValueEntry(fieldKey, idx)}
                            className="rounded border border-red-200 px-2 py-1 text-fluid-2xs text-red-700"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-slate-100 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-fluid-sm font-semibold text-slate-800">특이사항 줄 합치기</h3>
                <p className="mt-1 text-fluid-2xs text-slate-500">
                  「특이사항1」「특이사항2」처럼 여러 열을 순서대로 줄바꿈해 한 칸에 넣습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => patchMemoLineGroup({ excelHeaders: [...memoLineHeaders, ''] })}
                className="rounded-lg border border-slate-300 px-2 py-1 text-fluid-2xs hover:bg-slate-50"
              >
                + 줄 추가
              </button>
            </div>
            <label className="mb-3 block text-fluid-xs text-slate-600">
              합칠 청소비서 필드
              <select
                value={memoLineGroup.targetFieldKey ?? 'specialNotes'}
                onChange={(e) =>
                  patchMemoLineGroup({
                    targetFieldKey: e.target.value === 'memo' ? 'memo' : 'specialNotes',
                  })
                }
                className="mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-1.5"
              >
                <option value="specialNotes">특이사항 (관리자·팀장 공유)</option>
                <option value="memo">메모</option>
              </select>
            </label>
            {memoLineHeaders.length === 0 ? (
              <p className="text-fluid-2xs text-slate-500">「+ 줄 추가」로 열을 지정하세요.</p>
            ) : (
              <div className="space-y-2">
                {memoLineHeaders.map((header, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <span className="w-8 shrink-0 text-center text-fluid-2xs tabular-nums text-slate-500">
                      {idx + 1}줄
                    </span>
                    <select
                      value={header}
                      onChange={(e) => {
                        const next = [...memoLineHeaders];
                        next[idx] = e.target.value;
                        patchMemoLineGroup({ excelHeaders: next });
                      }}
                      className="min-w-[10rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                    >
                      <option value="">— 엑셀 헤더 —</option>
                      {headerSelectOptions(excelHeaders, header).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                        const next = [...memoLineHeaders];
                        [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
                        patchMemoLineGroup({ excelHeaders: next });
                      }}
                      className="rounded border border-slate-200 px-2 py-1 text-fluid-2xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === memoLineHeaders.length - 1}
                      onClick={() => {
                        const next = [...memoLineHeaders];
                        [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
                        patchMemoLineGroup({ excelHeaders: next });
                      }}
                      className="rounded border border-slate-200 px-2 py-1 text-fluid-2xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patchMemoLineGroup({ excelHeaders: memoLineHeaders.filter((_, i) => i !== idx) })
                      }
                      className="rounded border border-red-200 px-2 py-1 text-fluid-2xs text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-fluid-sm font-semibold text-slate-800">미매핑·기본값</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-fluid-xs text-slate-600">
                상태 미매핑 시 기본값
                <select
                  value={spec.defaultStatus ?? 'RECEIVED'}
                  onChange={(e) => onSpecChange({ ...spec, defaultStatus: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                >
                  {Object.entries(INQUIRY_EXCEL_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-fluid-xs text-slate-600">
                상태 미매핑 정책
                <select
                  value={spec.unmappedPolicies?.status ?? 'ERROR'}
                  onChange={(e) =>
                    onSpecChange({
                      ...spec,
                      unmappedPolicies: {
                        ...spec.unmappedPolicies,
                        status: e.target.value as 'ERROR' | 'USE_DEFAULT' | 'SKIP_ROW',
                      },
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                >
                  <option value="ERROR">오류</option>
                  <option value="USE_DEFAULT">기본값 사용</option>
                  <option value="SKIP_ROW">행 건너뛰기</option>
                </select>
              </label>
              <label className="text-fluid-xs text-slate-600 sm:col-span-2">
                평수 기준 기본값
                <span className="ml-1 font-normal text-slate-500">(평수 열은 있는데 평수 기준 열이 없을 때)</span>
                <select
                  value={spec.defaultAreaBasis ?? INQUIRY_EXCEL_DEFAULT_AREA_BASIS}
                  onChange={(e) =>
                    onSpecChange({
                      ...spec,
                      defaultAreaBasis: e.target.value === '전용' ? '전용' : '공급',
                    })
                  }
                  className="mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-1.5"
                >
                  {INQUIRY_EXCEL_AREA_BASIS_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v === '공급' ? '공급면적 (분양평수)' : '전용면적 (실제 내 집 공간)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
