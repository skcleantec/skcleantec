import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import {
  INQUIRY_EXCEL_DEFAULT_AREA_BASIS,
  INQUIRY_EXCEL_FIELD_CATALOG,
} from '@shared/inquiryExcelImportFields';
import type { InquiryExcelMappingSpec } from '@shared/inquiryExcelImportPolicy';
import {
  analyzeInquiryExcelSample,
  createInquiryExcelProfile,
  deleteInquiryExcelProfile,
  getInquiryExcelFieldCatalog,
  getInquiryExcelProfile,
  listInquiryExcelProfiles,
  previewInquiryExcelImport,
  updateInquiryExcelProfile,
  type InquiryExcelFieldCatalog,
  type InquiryExcelPreviewResponse,
  type InquiryExcelProfile,
} from '../../api/inquiryExcelImport';
import { InquiryExcelMappingAdvancedSection } from '../../components/admin/inquiryExcel/InquiryExcelMappingAdvancedSection';
import { InquiryExcelMappingColumnSection } from '../../components/admin/inquiryExcel/InquiryExcelMappingColumnSection';
import { InquiryExcelMappingPreviewPanel } from '../../components/admin/inquiryExcel/InquiryExcelMappingPreviewPanel';
import {
  collectExcelHeadersFromSpec,
  computeMappingProgress,
  mergeExcelHeaderLists,
  type ExcelColumnFilter,
} from '../../utils/inquiryExcelMappingUi';

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
    knownHeaders: p.mappingSpec.knownHeaders,
    headerSamples: p.mappingSpec.headerSamples,
  };
}

function specForSave(spec: InquiryExcelMappingSpec, excelHeaders: string[], headerSamples: Record<string, string[]>) {
  return {
    ...spec,
    knownHeaders: excelHeaders.length ? excelHeaders : spec.knownHeaders,
    headerSamples: Object.keys(headerSamples).length ? headerSamples : spec.headerSamples,
  };
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
  const [headerSamples, setHeaderSamples] = useState<Record<string, string[]>>({});
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [columnFilter, setColumnFilter] = useState<ExcelColumnFilter>('unmapped');
  const [headerSearch, setHeaderSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<InquiryExcelPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const columnSectionRef = useRef<HTMLDivElement | null>(null);
  const scrollToHeaderRef = useRef<(header: string) => void>(() => {});

  const fieldOptions = useMemo(() => INQUIRY_EXCEL_FIELD_CATALOG, []);
  const memoLineHeaders = spec.memoLineMappings?.[0]?.excelHeaders ?? [];

  const progress = useMemo(
    () =>
      computeMappingProgress(spec, excelHeaders, memoLineHeaders, (key) =>
        fieldOptions.find((f) => f.key === key),
      ),
    [spec, excelHeaders, memoLineHeaders, fieldOptions],
  );

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
      setHeaderSamples({});
      setSampleFile(null);
      setPreview(null);
      return;
    }
    const p = await getInquiryExcelProfile(token, editId);
    const loadedSpec = specFromProfile(p);
    setName(p.name);
    setSpec(loadedSpec);
    setExcelHeaders((prev) => mergeExcelHeaderLists(prev, collectExcelHeadersFromSpec(loadedSpec)));
    setHeaderSamples(loadedSpec.headerSamples ?? {});
    setPreview(null);
  }, [token, editId]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([loadProfiles(), loadCatalog(), loadEdit()])
      .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token, loadProfiles, loadCatalog, loadEdit]);

  const handleSampleUpload = async (file: File | null) => {
    if (!token || !file) return;
    setError(null);
    setPreview(null);
    try {
      const { headers, headerSamples: samples } = await analyzeInquiryExcelSample(token, file);
      setSampleFile(file);
      setExcelHeaders((prev) => mergeExcelHeaderLists(prev, headers));
      setHeaderSamples((prev) => ({ ...prev, ...samples }));
      setSpec((prev) => ({
        ...prev,
        knownHeaders: mergeExcelHeaderLists(prev.knownHeaders ?? [], headers),
        headerSamples: { ...prev.headerSamples, ...samples },
      }));
      setColumnFilter('unmapped');
      setMessage(`샘플 ${headers.length}개 열을 불러왔습니다. 아래에서 연결해 주세요.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '샘플 분석 실패');
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (progress.requiredMapped < progress.requiredTotal) {
      setError(`필수 항목(${progress.missingRequiredLabels.join(', ')})의 엑셀 열을 연결해 주세요.`);
      return;
    }
    if (editId && spec.columnMappings.length === 0) {
      const ok = window.confirm(
        '열 매핑이 하나도 없습니다. 저장하면 이 서식의 기존 열 매핑이 모두 지워집니다. 계속할까요?',
      );
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const payloadSpec = specForSave(spec, excelHeaders, headerSamples);
    try {
      if (editId) {
        await updateInquiryExcelProfile(token, editId, { name, mappingSpec: payloadSpec });
        setSpec(payloadSpec);
        setMessage('저장했습니다.');
      } else {
        const created = await createInquiryExcelProfile(token, { name, mappingSpec: payloadSpec });
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

  const handleDuplicate = (p: InquiryExcelProfile) => {
    const loadedSpec = specFromProfile(p);
    setSearchParams({});
    setName(`${p.name} (복사)`);
    setSpec(loadedSpec);
    setExcelHeaders(collectExcelHeadersFromSpec(loadedSpec));
    setHeaderSamples(loadedSpec.headerSamples ?? {});
    setSampleFile(null);
    setPreview(null);
    setMessage('서식을 복사했습니다. 이름 확인 후 저장하세요.');
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

  const handlePreview = async () => {
    if (!token || !editId || !sampleFile) {
      setError('미리보기는 저장된 서식과 샘플 엑셀 파일이 필요합니다.');
      return;
    }
    setPreviewLoading(true);
    setError(null);
    try {
      const payloadSpec = specForSave(spec, excelHeaders, headerSamples);
      const data = await previewInquiryExcelImport(token, editId, sampleFile, payloadSpec);
      setPreview(data);
      setMessage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '미리보기 실패');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <PageTitleWithFavorite label="매칭 서식 관리">
          <h1 className="text-fluid-lg font-semibold text-slate-900">매칭 서식 관리</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-fluid-sm text-slate-600">
          ① 샘플 업로드 → ② 열 연결 → ③ (필요 시) 고급 설정 → ④ 미리보기 후 저장
        </p>
        {excelHeaders.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-2xs text-slate-700">
            <span>
              필수{' '}
              <strong className="tabular-nums">
                {progress.requiredMapped}/{progress.requiredTotal}
              </strong>
            </span>
            <span>
              연결된 열 <strong className="tabular-nums">{progress.mappedColumnCount}</strong>
            </span>
            <span>
              미연결 열 <strong className="tabular-nums text-amber-800">{progress.unmappedHeaderCount}</strong>
            </span>
            <span>
              전체 열 <strong className="tabular-nums">{progress.totalHeaderCount}</strong>
            </span>
          </div>
        ) : null}
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
              onClick={() => {
                setSearchParams({});
                setName('');
                setSpec({ ...EMPTY_SPEC, columnMappings: [], valueMappings: [] });
                setExcelHeaders([]);
                setHeaderSamples({});
                setSampleFile(null);
                setPreview(null);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-fluid-2xs hover:bg-slate-50"
            >
              새로
            </button>
          </div>
          <ul className="space-y-1">
            {profiles.map((p) => (
              <li key={p.id} className="group flex gap-1">
                <button
                  type="button"
                  onClick={() => setSearchParams({ profileId: p.id })}
                  className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-fluid-xs ${
                    editId === p.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block truncate">{p.name}</span>
                </button>
                <button
                  type="button"
                  title="복제"
                  onClick={() => handleDuplicate(p)}
                  className="shrink-0 rounded-lg border border-slate-200 px-1.5 py-1 text-fluid-2xs text-slate-500 opacity-70 hover:bg-slate-50 group-hover:opacity-100"
                >
                  복제
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
              <label className="block text-fluid-sm font-medium text-slate-700">샘플 엑셀</label>
              <p className="mt-0.5 text-fluid-2xs text-slate-500">헤더와 예시 값만 불러옵니다. 자동 연결하지 않습니다.</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-1 block w-full text-fluid-xs"
                onChange={(e) => void handleSampleUpload(e.target.files?.[0] ?? null)}
              />
              {sampleFile ? (
                <p className="mt-1 text-fluid-2xs text-slate-500">파일: {sampleFile.name}</p>
              ) : editId && excelHeaders.length > 0 ? (
                <p className="mt-1 text-fluid-2xs text-slate-500">
                  저장된 열 {excelHeaders.length}개 · 예시 갱신·미리보기는 샘플을 다시 선택하세요.
                </p>
              ) : null}
            </div>
          </div>

          <div ref={columnSectionRef}>
            <InquiryExcelMappingColumnSection
              spec={spec}
              excelHeaders={excelHeaders}
              headerSamples={headerSamples}
              memoLineHeaders={memoLineHeaders}
              columnFilter={columnFilter}
              headerSearch={headerSearch}
              onSpecChange={(next) => {
                setSpec(next);
                setPreview(null);
              }}
              onColumnFilterChange={setColumnFilter}
              onHeaderSearchChange={setHeaderSearch}
              scrollToHeaderRef={scrollToHeaderRef}
            />
          </div>

          <InquiryExcelMappingAdvancedSection
            spec={spec}
            excelHeaders={excelHeaders}
            catalog={catalog}
            fieldOptions={fieldOptions}
            onSpecChange={(next) => {
              setSpec(next);
              setPreview(null);
            }}
          />

          <InquiryExcelMappingPreviewPanel
            preview={preview}
            loading={previewLoading}
            canPreview={Boolean(editId && sampleFile)}
            onPreview={() => void handlePreview()}
            onScrollToColumnSection={() => columnSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />

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
