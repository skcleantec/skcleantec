import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  fetchInspectionTemplate,
  resetInspectionTemplate,
  saveInspectionTemplate,
  type InspectionTemplateDto,
} from '../../api/inspectionTemplate';
import type { InspectionItemDef } from '@shared/inquiryInspectionItems';
import { buildDefaultTenantTemplateSnapshot } from '@shared/inquiryInspectionTenantTemplate';

function newItemKey(existing: InspectionItemDef[]): string {
  let n = existing.length + 1;
  let key = `extra_${n}`;
  const used = new Set(existing.map((i) => i.itemKey));
  while (used.has(key)) {
    n += 1;
    key = `extra_${n}`;
  }
  return key;
}

export function AdminInspectionTemplatePage() {
  const token = getToken();
  const [dto, setDto] = useState<InspectionTemplateDto | null>(null);
  const [effective, setEffective] = useState<Record<string, InspectionItemDef[]>>({});
  const [selectedKey, setSelectedKey] = useState('entrance');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchInspectionTemplate(token);
      setDto(data);
      setEffective(data.effective);
      setSelectedKey((prev) => (data.effective[prev] ? prev : (data.catalog[0]?.templateKey ?? prev)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentItems = effective[selectedKey] ?? [];
  const defaults = dto?.defaults ?? buildDefaultTenantTemplateSnapshot();
  const isCustomArea = useMemo(() => {
    const def = defaults[selectedKey];
    const cur = effective[selectedKey];
    if (!def || !cur) return false;
    if (def.length !== cur.length) return true;
    return def.some((it, i) => it.itemKey !== cur[i]?.itemKey || it.label !== cur[i]?.label);
  }, [defaults, effective, selectedKey]);

  const patchItems = (items: InspectionItemDef[]) => {
    setEffective((prev) => ({ ...prev, [selectedKey]: items }));
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      const data = await saveInspectionTemplate(token, effective);
      setDto(data);
      setEffective(data.effective);
      setSavedMsg('저장했습니다. 새로 여는 검수 체크리스트부터 적용됩니다.');
      window.setTimeout(() => setSavedMsg(null), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!token) return;
    if (!window.confirm('모든 구역을 시스템 기본 템플릿으로 되돌릴까요?')) return;
    setSaving(true);
    setErr(null);
    try {
      const data = await resetInspectionTemplate(token);
      setDto(data);
      setEffective(data.effective);
      setSavedMsg('기본 템플릿으로 되돌렸습니다.');
      window.setTimeout(() => setSavedMsg(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '초기화 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResetArea = () => {
    const def = defaults[selectedKey];
    if (!def) return;
    if (!window.confirm('이 구역만 시스템 기본으로 되돌릴까요?')) return;
    setEffective((prev) => ({ ...prev, [selectedKey]: def.map((it) => ({ ...it })) }));
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  return (
    <div className="min-w-0 w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">현장 검수 체크리스트 템플릿</h1>
        <p className="mt-1 text-sm text-gray-500">
          구역별 세부 항목(사진 단위)을 업체마다 다르게 설정할 수 있습니다. 이미 진행 중인 검수에는 기존 항목이
          유지되며, 새로 열리는 체크리스트·누락 항목 보강 시 반영됩니다.
        </p>
      </div>

      {err ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>
      ) : null}
      {savedMsg ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{savedMsg}</p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        <nav className="shrink-0 sm:w-44 space-y-1">
          {(dto?.catalog ?? []).map((area) => {
            const custom =
              defaults[area.templateKey] &&
              effective[area.templateKey] &&
              (defaults[area.templateKey]!.length !== effective[area.templateKey]!.length ||
                defaults[area.templateKey]!.some(
                  (it, i) =>
                    it.itemKey !== effective[area.templateKey]![i]?.itemKey ||
                    it.label !== effective[area.templateKey]![i]?.label,
                ));
            return (
              <button
                key={area.templateKey}
                type="button"
                onClick={() => setSelectedKey(area.templateKey)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm ${
                  selectedKey === area.templateKey
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
                }`}
              >
                {area.label}
                {custom ? <span className="ml-1 text-xs opacity-80">· 수정됨</span> : null}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {dto?.catalog.find((c) => c.templateKey === selectedKey)?.label ?? selectedKey}
            </h2>
            {isCustomArea ? (
              <button
                type="button"
                onClick={handleResetArea}
                className="text-xs text-gray-600 underline hover:text-gray-900"
              >
                이 구역 기본값 복원
              </button>
            ) : null}
          </div>

          <ul className="space-y-2">
            {currentItems.map((item, idx) => (
              <li
                key={`${item.itemKey}-${idx}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 bg-gray-50/80 px-2 py-2"
              >
                <span className="w-6 shrink-0 text-center text-xs text-gray-400 tabular-nums">{idx + 1}</span>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => {
                    const next = [...currentItems];
                    next[idx] = { ...item, label: e.target.value };
                    patchItems(next);
                  }}
                  className="min-w-[8rem] flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="항목 이름"
                />
                <input
                  type="text"
                  value={item.itemKey}
                  readOnly={defaults[selectedKey]?.some((d) => d.itemKey === item.itemKey)}
                  onChange={(e) => {
                    const next = [...currentItems];
                    next[idx] = { ...item, itemKey: e.target.value.replace(/[^a-z0-9_]/g, '') };
                    patchItems(next);
                  }}
                  className="w-32 shrink-0 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-mono text-gray-600"
                  title="항목 키 (영문 소문자·숫자·_)"
                />
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      const next = [...currentItems];
                      [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
                      patchItems(next);
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx >= currentItems.length - 1}
                    onClick={() => {
                      const next = [...currentItems];
                      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
                      patchItems(next);
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => patchItems(currentItems.filter((_, i) => i !== idx))}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => {
              patchItems([...currentItems, { itemKey: newItemKey(currentItems), label: '새 항목' }]);
            }}
            className="text-sm text-indigo-700 hover:underline"
          >
            + 항목 추가
          </button>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => void handleResetAll()}
          disabled={saving}
          className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          전체 기본값으로
        </button>
      </div>
    </div>
  );
}
