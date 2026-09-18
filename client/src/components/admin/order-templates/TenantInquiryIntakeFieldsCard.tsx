import { useEffect, useMemo, useState } from 'react';
import {
  getInquiryIntakeFields,
  saveInquiryIntakeFields,
  type InquiryIntakeFieldsState,
} from '../../../api/orderFormTemplates';
import { HelpTooltip } from '../../ui/HelpTooltip';

type Props = {
  token: string;
};

export function TenantInquiryIntakeFieldsCard({ token }: Props) {
  const [state, setState] = useState<InquiryIntakeFieldsState | null>(null);
  const [draftOn, setDraftOn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getInquiryIntakeFields(token)
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setDraftOn(new Set(next.keys));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '접수 칸을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dirty = useMemo(() => {
    if (!state) return false;
    const a = [...state.keys].sort().join(',');
    const b = [...draftOn].sort().join(',');
    return a !== b;
  }, [state, draftOn]);

  function toggle(key: string, locked: boolean) {
    if (locked) return;
    setDraftOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSavedHint(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const next = await saveInquiryIntakeFields(token, [...draftOn]);
      setState(next);
      setDraftOn(new Set(next.keys));
      setSavedHint('저장했습니다. 전화·수기 접수와 기본 발주서로 들어온 접수 수정에 바로 반영됩니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-fluid-sm font-semibold text-slate-900">우리 접수 칸</h2>
            <HelpTooltip text="입주·이사가 아닌 업체는 건축물 유형·이사일처럼 안 쓰는 칸을 끄면 됩니다. 끈 칸은 전화·수기 접수와 접수 수정에서 같이 숨습니다. 손님에게 보내는 기본 입주청소 발주서는 그대로입니다. 내가 만든 양식은 그 양식의 항목을 따릅니다." />
          </div>
          <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">
            전화로 받는 접수에 어떤 칸을 쓸지 정합니다. 이름·전화·주소는 끌 수 없습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !dirty}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? '저장 중…' : '접수 칸 저장'}
        </button>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-2xs text-red-700">
          {error}
        </p>
      ) : null}
      {savedHint ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-fluid-2xs text-emerald-800">
          {savedHint}
        </p>
      ) : null}

      {loading || !state ? (
        <p className="mt-3 text-fluid-xs text-slate-400">불러오는 중…</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
              <p className="mb-1.5 text-fluid-2xs font-medium text-slate-600">{group.title}</p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <label className="flex min-h-9 items-center gap-2 text-fluid-xs text-slate-800">
                      <input
                        type="checkbox"
                        checked={draftOn.has(item.key)}
                        disabled={item.locked}
                        onChange={() => toggle(item.key, item.locked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        {item.label}
                        {item.locked ? (
                          <span className="ml-1 text-fluid-2xs text-slate-400">항상</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
