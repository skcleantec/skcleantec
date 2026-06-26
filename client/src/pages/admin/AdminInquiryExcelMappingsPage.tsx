import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  INQUIRY_EXCEL_FIELD_CATALOG,
  INQUIRY_EXCEL_AREA_BASIS_VALUES,
  INQUIRY_EXCEL_DEFAULT_AREA_BASIS,
  INQUIRY_EXCEL_STATUS_LABELS,
  INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS,
} from '@shared/inquiryExcelImportFields';
import type { InquiryExcelMappingSpec } from '@shared/inquiryExcelImportPolicy';
import {
  analyzeInquiryExcelSample,
  createInquiryExcelProfile,
  deleteInquiryExcelProfile,
  getInquiryExcelFieldCatalog,
  getInquiryExcelProfile,
  listInquiryExcelProfiles,
  updateInquiryExcelProfile,
  type InquiryExcelFieldCatalog,
  type InquiryExcelProfile,
} from '../../api/inquiryExcelImport';

const EMPTY_SPEC: InquiryExcelMappingSpec = {
  columnMappings: [],
  valueMappings: [],
  emptyValueRules: [],
  unmappedPolicies: { status: 'ERROR' },
  defaultStatus: 'RECEIVED',
  defaultAreaBasis: INQUIRY_EXCEL_DEFAULT_AREA_BASIS,
  memoLineMappings: [{ targetFieldKey: 'specialNotes', excelHeaders: [] }],
};

function specFromProfile(p: InquiryExcelProfile | null): InquiryExcelMappingSpec {
  if (!p?.mappingSpec) return { ...EMPTY_SPEC, columnMappings: [], valueMappings: [] };
  return {
    columnMappings: p.mappingSpec.columnMappings ?? [],
    valueMappings: p.mappingSpec.valueMappings ?? [],
    emptyValueRules: p.mappingSpec.emptyValueRules ?? [],
    unmappedPolicies: p.mappingSpec.unmappedPolicies ?? { status: 'ERROR' },
    defaultStatus: p.mappingSpec.defaultStatus ?? 'RECEIVED',
    defaultAreaBasis: p.mappingSpec.defaultAreaBasis ?? INQUIRY_EXCEL_DEFAULT_AREA_BASIS,
    memoLineMappings:
      p.mappingSpec.memoLineMappings?.length
        ? p.mappingSpec.memoLineMappings
        : [{ targetFieldKey: 'specialNotes', excelHeaders: [] }],
  };
}

/** 저장된 mappingSpec에 들어 있는 엑셀 헤더 — 재배포 후 샘플 미업로드 시 드롭다운 복원용 */
function collectExcelHeadersFromSpec(spec: InquiryExcelMappingSpec): string[] {
  const set = new Set<string>();
  for (const m of spec.columnMappings) {
    if (m.excelHeader) set.add(m.excelHeader);
  }
  for (const g of spec.memoLineMappings ?? []) {
    for (const h of g.excelHeaders ?? []) {
      if (h) set.add(h);
    }
  }
  return [...set];
}

function mergeExcelHeaderLists(...lists: string[][]): string[] {
  const set = new Set<string>();
  for (const list of lists) {
    for (const h of list) {
      if (h) set.add(h);
    }
  }
  return [...set];
}

function headerSelectOptions(excelHeaders: string[], selected: string): string[] {
  if (selected && !excelHeaders.includes(selected)) return [selected, ...excelHeaders];
  return excelHeaders;
}

export function AdminInquiryExcelMappingsPage() {
  const token = getToken();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('profileId') ?? '';

  const [profiles, setProfiles] = useState<InquiryExcelProfile[]>([]);
  const [catalog, setCatalog] = useState<InquiryExcelFieldCatalog | null>(null);
  const [name, setName] = useState('');
  const [spec, setSpec] = useState<InquiryExcelMappingSpec>(EMPTY_SPEC);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fieldOptions = useMemo(() => INQUIRY_EXCEL_FIELD_CATALOG, []);

  const loadProfiles = useCallback(async () => {
    if (!token) return;
    const { items } = await listInquiryExcelProfiles(token);
    setProfiles(items);
  }, [token]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    setCatalog(await getInquiryExcelFieldCatalog(token));
  }, [token]);

  const loadEdit = useCallback(async () => {
    if (!token || !editId) {
      setName('');
      setSpec({ ...EMPTY_SPEC, columnMappings: [], valueMappings: [] });
      setExcelHeaders([]);
      return;
    }
    const p = await getInquiryExcelProfile(token, editId);
    const loadedSpec = specFromProfile(p);
    setName(p.name);
    setSpec(loadedSpec);
    setExcelHeaders((prev) => mergeExcelHeaderLists(prev, collectExcelHeadersFromSpec(loadedSpec)));
  }, [token, editId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([loadProfiles(), loadCatalog(), loadEdit()])
      .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token, loadProfiles, loadCatalog, loadEdit]);

  const setColumnHeader = (fieldKey: string, excelHeader: string) => {
    setSpec((prev) => {
      const rest = prev.columnMappings.filter((m) => m.fieldKey !== fieldKey);
      if (!excelHeader) return { ...prev, columnMappings: rest };
      return { ...prev, columnMappings: [...rest, { fieldKey, excelHeader }] };
    });
  };

  const getColumnHeader = (fieldKey: string) =>
    spec.columnMappings.find((m) => m.fieldKey === fieldKey)?.excelHeader ?? '';

  const addValueEntry = (fieldKey: string) => {
    setSpec((prev) => {
      const vm = prev.valueMappings.find((v) => v.fieldKey === fieldKey);
      if (vm) {
        return {
          ...prev,
          valueMappings: prev.valueMappings.map((v) =>
            v.fieldKey === fieldKey ? { ...v, entries: [...v.entries, { excelValue: '', skValue: '' }] } : v,
          ),
        };
      }
      return {
        ...prev,
        valueMappings: [...prev.valueMappings, { fieldKey, entries: [{ excelValue: '', skValue: '' }] }],
      };
    });
  };

  const updateValueEntry = (
    fieldKey: string,
    index: number,
    patch: Partial<{ excelValue: string; skValue: string }>,
  ) => {
    setSpec((prev) => ({
      ...prev,
      valueMappings: prev.valueMappings.map((v) =>
        v.fieldKey === fieldKey
          ? {
              ...v,
              entries: v.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
            }
          : v,
      ),
    }));
  };

  const removeValueEntry = (fieldKey: string, index: number) => {
    setSpec((prev) => ({
      ...prev,
      valueMappings: prev.valueMappings
        .map((v) =>
          v.fieldKey === fieldKey ? { ...v, entries: v.entries.filter((_, i) => i !== index) } : v,
        )
        .filter((v) => v.entries.length > 0),
    }));
  };

  const memoLineGroup = spec.memoLineMappings?.[0] ?? { targetFieldKey: 'specialNotes' as const, excelHeaders: [] };
  const memoLineHeaders = memoLineGroup.excelHeaders ?? [];

  const patchMemoLineGroup = (patch: Partial<{ targetFieldKey: 'specialNotes' | 'memo'; excelHeaders: string[] }>) => {
    setSpec((prev) => {
      const cur = prev.memoLineMappings?.[0] ?? { targetFieldKey: 'specialNotes' as const, excelHeaders: [] };
      return {
        ...prev,
        memoLineMappings: [{ ...cur, ...patch }],
      };
    });
  };

  const addMemoLineHeader = () => {
    patchMemoLineGroup({ excelHeaders: [...memoLineHeaders, ''] });
  };

  const updateMemoLineHeader = (index: number, header: string) => {
    const next = [...memoLineHeaders];
    next[index] = header;
    patchMemoLineGroup({ excelHeaders: next });
  };

  const removeMemoLineHeader = (index: number) => {
    patchMemoLineGroup({ excelHeaders: memoLineHeaders.filter((_, i) => i !== index) });
  };

  const moveMemoLineHeader = (index: number, delta: -1 | 1) => {
    const next = [...memoLineHeaders];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j]!, next[index]!];
    patchMemoLineGroup({ excelHeaders: next });
  };

  const headersUsedInMemoLines = useMemo(() => new Set(memoLineHeaders.filter(Boolean)), [memoLineHeaders]);

  const savedMappingSummary = useMemo(() => {
    const mapped = spec.columnMappings.filter((m) => m.excelHeader);
    const memoLines = memoLineHeaders.filter(Boolean).length;
    return { columnCount: mapped.length, memoLines, valueGroups: spec.valueMappings.length };
  }, [spec.columnMappings, spec.valueMappings.length, memoLineHeaders]);

  const handleSampleUpload = async (file: File | null) => {
    if (!token || !file) return;
    setError(null);
    try {
      const { headers } = await analyzeInquiryExcelSample(token, file);
      setExcelHeaders((prev) => mergeExcelHeaderLists(prev, headers));
      setMessage(`샘플 헤더 ${headers.length}개를 불러왔습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '샘플 분석 실패');
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (editId && spec.columnMappings.length === 0) {
      const ok = window.confirm(
        '열 매핑이 하나도 없습니다. 저장하면 이 서식의 기존 열 매핑이 모두 지워집니다. 계속할까요?',
      );
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editId) {
        await updateInquiryExcelProfile(token, editId, { name, mappingSpec: spec });
        setMessage('저장했습니다.');
      } else {
        const created = await createInquiryExcelProfile(token, { name, mappingSpec: spec });
        setSearchParams({ profileId: created.id });
        setMessage('새 서식을 저장했습니다.');
      }
      await loadProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !editId) return;
    if (!window.confirm('이 매칭 서식을 삭제할까요?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteInquiryExcelProfile(token, editId);
      setSearchParams({});
      await loadProfiles();
      setMessage('삭제했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setSaving(false);
    }
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
      return [
        { value: '오전', label: '오전' },
        { value: '오후', label: '오후' },
        { value: '사이청소', label: '사이청소' },
      ];
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

  if (loading) {
    return <p className="p-6 text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h1 className="text-fluid-lg font-semibold text-slate-900">매칭 서식 관리</h1>
        <p className="mt-1 text-fluid-sm text-slate-600">
          엑셀 헤더 ↔ SK 필드 매핑과 상태·운영사 등 값 변환 규칙을 저장합니다.
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

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-fluid-sm font-semibold text-slate-800">저장된 서식</h2>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="rounded-lg border border-slate-300 px-2 py-1 text-fluid-2xs hover:bg-slate-50"
            >
              새로
            </button>
          </div>
          <ul className="space-y-1">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSearchParams({ profileId: p.id })}
                  className={`w-full rounded-lg px-2 py-2 text-left text-fluid-xs ${
                    editId === p.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
            {profiles.length === 0 ? (
              <li className="px-2 py-4 text-center text-fluid-xs text-slate-500">저장된 서식 없음</li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-fluid-sm font-medium text-slate-700">서식 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-fluid-sm"
              placeholder="예: ○○업체 일일 접수"
            />
            <div className="mt-3">
              <label className="block text-fluid-sm font-medium text-slate-700">샘플 엑셀 (헤더 분석)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-1 block w-full text-fluid-xs"
                onChange={(e) => void handleSampleUpload(e.target.files?.[0] ?? null)}
              />
              {excelHeaders.length > 0 ? (
                <p className="mt-1 text-fluid-2xs text-slate-500">헤더: {excelHeaders.join(', ')}</p>
              ) : editId ? (
                <p className="mt-1 text-fluid-2xs text-amber-800">
                  저장된 열 매핑은 DB에 있지만, 드롭다운 목록을 채우려면 같은 형식의 샘플 엑셀을 한 번 올려 주세요.
                </p>
              ) : null}
            </div>
            {editId && savedMappingSummary.columnCount > 0 ? (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-2xs text-slate-700">
                저장됨 — 열 {savedMappingSummary.columnCount}개
                {savedMappingSummary.memoLines > 0 ? ` · 줄 합치기 ${savedMappingSummary.memoLines}줄` : ''}
                {savedMappingSummary.valueGroups > 0 ? ` · 값 매핑 ${savedMappingSummary.valueGroups}그룹` : ''}
                . 총액 등만 추가할 때는 아래에서 해당 필드만 고른 뒤 저장하세요.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
            <h2 className="mb-3 text-fluid-sm font-semibold text-slate-800">열 매핑</h2>
            <div className="lg:hidden space-y-3">
              {fieldOptions.map((f) => (
                <div key={f.key} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-fluid-xs font-medium text-slate-800">
                    {f.label}
                    {f.required ? <span className="text-red-500"> *</span> : null}
                  </p>
                  <select
                    value={getColumnHeader(f.key)}
                    onChange={(e) => setColumnHeader(f.key, e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                  >
                    <option value="">— 매핑 안 함 —</option>
                    {headerSelectOptions(excelHeaders, getColumnHeader(f.key)).map((h) => (
                      <option key={h} value={h} disabled={headersUsedInMemoLines.has(h)}>
                        {h}
                        {headersUsedInMemoLines.has(h) ? ' (줄 합치기)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="hidden lg:block w-full min-w-0 overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-fluid-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-200 px-2 py-2 text-center">SK 필드</th>
                    <th className="border border-slate-200 px-2 py-2 text-center">엑셀 헤더</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldOptions.map((f) => (
                    <tr key={f.key} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        {f.label}
                        {f.required ? <span className="text-red-500"> *</span> : null}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <select
                          value={getColumnHeader(f.key)}
                          onChange={(e) => setColumnHeader(f.key, e.target.value)}
                          className="w-full max-w-xs rounded border border-slate-300 px-2 py-1"
                        >
                          <option value="">—</option>
                          {headerSelectOptions(excelHeaders, getColumnHeader(f.key)).map((h) => (
                            <option key={h} value={h} disabled={headersUsedInMemoLines.has(h)}>
                              {h}
                              {headersUsedInMemoLines.has(h) ? ' (줄 합치기)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {INQUIRY_EXCEL_VALUE_MAPPING_FIELD_KEYS.map((fieldKey) => {
            const fieldDef = fieldOptions.find((f) => f.key === fieldKey);
            const vm = spec.valueMappings.find((v) => v.fieldKey === fieldKey);
            const entries = vm?.entries ?? [];
            const skOpts = skOptionsForField(fieldKey);
            if (skOpts.length === 0 && fieldKey !== 'source' && fieldKey !== 'propertyType') return null;
            return (
              <div key={fieldKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-fluid-sm font-semibold text-slate-800">
                    값 매핑 — {fieldDef?.label ?? fieldKey}
                  </h2>
                  <button
                    type="button"
                    onClick={() => addValueEntry(fieldKey)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-fluid-2xs hover:bg-slate-50"
                  >
                    + 행 추가
                  </button>
                </div>
                {entries.length === 0 ? (
                  <p className="text-fluid-xs text-slate-500">엑셀 값 → SK 값 변환 규칙을 추가하세요.</p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <input
                          value={entry.excelValue}
                          onChange={(e) => updateValueEntry(fieldKey, idx, { excelValue: e.target.value })}
                          placeholder="엑셀 값"
                          className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                        />
                        <span className="text-slate-400">→</span>
                        {skOpts.length > 0 ? (
                          <select
                            value={entry.skValue}
                            onChange={(e) => updateValueEntry(fieldKey, idx, { skValue: e.target.value })}
                            className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
                          >
                            <option value="">SK 값</option>
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
                            placeholder="SK 값"
                            className="min-w-[8rem] flex-1 rounded border border-slate-300 px-2 py-1.5 text-fluid-xs"
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-fluid-sm font-semibold text-slate-800">특이사항 줄 합치기</h2>
                <p className="mt-1 text-fluid-2xs text-slate-500">
                  「특이사항1」「특이사항2」처럼 SK에 1:1 필드가 없는 열은 순서대로 줄바꿈해 한 칸에 넣습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={addMemoLineHeader}
                className="rounded-lg border border-slate-300 px-2 py-1 text-fluid-2xs hover:bg-slate-50"
              >
                + 줄 추가
              </button>
            </div>
            <label className="mb-3 block text-fluid-xs text-slate-600">
              합칠 SK 필드
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
              <p className="text-fluid-xs text-slate-500">샘플 엑셀 업로드 후 「+ 줄 추가」로 열을 지정하세요.</p>
            ) : (
              <div className="space-y-2">
                {memoLineHeaders.map((header, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <span className="w-8 shrink-0 text-center text-fluid-2xs tabular-nums text-slate-500">
                      {idx + 1}줄
                    </span>
                    <select
                      value={header}
                      onChange={(e) => updateMemoLineHeader(idx, e.target.value)}
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
                      onClick={() => moveMemoLineHeader(idx, -1)}
                      className="rounded border border-slate-200 px-2 py-1 text-fluid-2xs disabled:opacity-40"
                      title="위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === memoLineHeaders.length - 1}
                      onClick={() => moveMemoLineHeader(idx, 1)}
                      className="rounded border border-slate-200 px-2 py-1 text-fluid-2xs disabled:opacity-40"
                      title="아래로"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMemoLineHeader(idx)}
                      className="rounded border border-red-200 px-2 py-1 text-fluid-2xs text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-fluid-sm font-semibold text-slate-800">미매핑·기본값</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-fluid-xs text-slate-600">
                상태 미매핑 시 기본값
                <select
                  value={spec.defaultStatus ?? 'RECEIVED'}
                  onChange={(e) => setSpec((p) => ({ ...p, defaultStatus: e.target.value }))}
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
                    setSpec((p) => ({
                      ...p,
                      unmappedPolicies: { ...p.unmappedPolicies, status: e.target.value as 'ERROR' | 'USE_DEFAULT' | 'SKIP_ROW' },
                    }))
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
                    setSpec((p) => ({
                      ...p,
                      defaultAreaBasis: e.target.value === '전용' ? '전용' : '공급',
                    }))
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            {editId ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="rounded-xl border border-red-300 px-4 py-2 text-fluid-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate('/admin/inquiries/bulk-excel/import' + (editId ? `?profileId=${editId}` : ''))}
              className="rounded-xl border border-slate-300 px-4 py-2 text-fluid-sm hover:bg-slate-50"
            >
              일괄 등록으로 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
