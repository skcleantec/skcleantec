import { useEffect, useMemo, useState } from 'react';
import {
  getInquiryIntakeFields,
  saveInquiryIntakeFields,
  type InquiryIntakeFieldItem,
  type InquiryIntakeFieldsState,
} from '../../../api/orderFormTemplates';
import { HelpTooltip } from '../../ui/HelpTooltip';

type Props = {
  token: string;
};

function groupOnCount(items: InquiryIntakeFieldItem[], draftOn: Set<string>) {
  return items.filter((item) => draftOn.has(item.key)).length;
}

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

  const onTotal = draftOn.size;
  const allTotal = state?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0;

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
      setSavedHint('저장했습니다. 전화·수기 접수에 바로 반영됩니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4 lg:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="text-fluid-sm font-semibold text-slate-900">우리 접수 칸</h2>
            <HelpTooltip text="입주·이사가 아닌 업체는 건축물 유형·이사일처럼 안 쓰는 칸을 끄면 됩니다. 끈 칸은 전화·수기 접수와 접수 수정에서 같이 숨습니다. 손님에게 보내는 기본 입주청소 발주서는 그대로입니다. 내가 만든 양식은 그 양식의 항목을 따릅니다." />
            {!loading && allTotal > 0 ? (
              <span className="text-fluid-2xs tabular-nums text-slate-500">
                사용 {onTotal}/{allTotal}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 hidden text-fluid-xs text-slate-500 lg:block">
            전화·수기 접수에 쓸 칸입니다. 이름·전화·주소는 항상 있습니다.
          </p>
          <p className="mt-0.5 text-fluid-2xs text-slate-500 lg:hidden">
            전화 접수에 쓸 칸 · 이름·전화·주소는 항상
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !dirty}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:min-h-10 lg:px-4 lg:text-fluid-sm"
        >
          {saving ? '저장 중…' : '접수 칸 저장'}
        </button>
      </div>

      {error ? (
        <p className="border-b border-red-100 bg-red-50 px-3 py-1.5 text-fluid-2xs text-red-700 sm:px-4">
          {error}
        </p>
      ) : null}
      {savedHint ? (
        <p className="border-b border-emerald-100 bg-emerald-50 px-3 py-1.5 text-fluid-2xs text-emerald-800 sm:px-4">
          {savedHint}
        </p>
      ) : null}

      {loading || !state ? (
        <p className="px-3 py-6 text-center text-fluid-xs text-slate-400">불러오는 중…</p>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-slate-100 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {state.groups.map((group) => {
            const onCount = groupOnCount(group.items, draftOn);
            const wide = group.id === 'property';
            return (
              <div
                key={group.id}
                className={`min-w-0 p-3 sm:p-3.5 ${wide ? 'lg:col-span-4' : 'lg:col-span-2'}`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-fluid-2xs font-semibold tracking-wide text-slate-500 lg:text-fluid-xs">
                    {group.title}
                  </p>
                  <p className="text-fluid-2xs tabular-nums text-slate-400">
                    {onCount}/{group.items.length}
                  </p>
                </div>
                <ul className={wide ? 'grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-2' : 'space-y-0.5'}>
                  {group.items.map((item) => {
                    const on = draftOn.has(item.key);
                    if (item.locked) {
                      return (
                        <li key={item.key}>
                          <div className="flex min-h-8 items-center justify-between gap-2 rounded-md px-1.5 py-1 text-fluid-xs text-slate-600 lg:min-h-9 lg:text-fluid-sm">
                            <span className="truncate" title={item.label}>
                              {item.label}
                            </span>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-fluid-2xs text-slate-500">
                              항상
                            </span>
                          </div>
                        </li>
                      );
                    }
                    return (
                      <li key={item.key}>
                        <label
                          className={`flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-fluid-xs transition-colors hover:bg-slate-50 lg:min-h-9 lg:text-fluid-sm ${
                            on ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          <span className="min-w-0 truncate" title={item.label}>
                            {item.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(item.key, item.locked)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
