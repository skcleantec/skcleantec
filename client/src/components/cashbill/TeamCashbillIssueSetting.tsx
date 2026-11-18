import { useEffect, useState } from 'react';
import { fetchTeamCashbillIssueSetting, saveTeamCashbillIssueSetting } from '../../api/cashbill';
import { OnOffSwitch } from '../ui/OnOffSwitch';

const labelCls = 'block text-fluid-xs font-medium text-slate-600';

/** 발행 기본설정(톱니) 창 안의 「팀장 발행」 칸. 바꾸면 바로 저장. */
export function TeamCashbillIssueSetting({ canEdit = true, showTaxKind = true }: { canEdit?: boolean; showTaxKind?: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [taxKind, setTaxKind] = useState<'taxable' | 'exempt'>('taxable');
  const [exemptLocked, setExemptLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    fetchTeamCashbillIssueSetting()
      .then((res) => {
        if (stop) return;
        setEnabled(res.enabled);
        setTaxKind(res.exemptLocked ? 'exempt' : res.taxKind === 'exempt' ? 'exempt' : 'taxable');
        setExemptLocked(Boolean(res.exemptLocked));
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '설정을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!stop) setLoading(false);
      });
    return () => {
      stop = true;
    };
  }, []);

  const save = (patch: { enabled?: boolean; taxKind?: 'taxable' | 'exempt' }) => {
    setSaving(true);
    setError(null);
    void saveTeamCashbillIssueSetting(patch)
      .then((res) => {
        setEnabled(res.enabled);
        setTaxKind(res.exemptLocked ? 'exempt' : res.taxKind);
        setExemptLocked(res.exemptLocked);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '저장하지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  const busy = loading || saving || !canEdit;

  return (
    <fieldset className="space-y-2 border-t border-slate-200 pt-3">
      <legend className="text-fluid-sm font-semibold text-slate-900">팀장 발행</legend>
      <div className="flex items-center justify-between gap-3">
        <span className={labelCls}>팀장도 발행할 수 있게 <span className="font-normal text-slate-500">· 현금영수증·세금계산서</span></span>
        <OnOffSwitch checked={enabled} disabled={busy} onChange={(next) => save({ enabled: next })} />
      </div>
      {showTaxKind ? (
        <div className="space-y-1">
          <span className={labelCls}>팀장 기본 과세/면세</span>
          {exemptLocked ? (
            <p className="text-fluid-xs text-slate-600">면세사업자는 면세로 고정됩니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {([
                ['taxable', '과세', 'border-sky-300 bg-sky-50 text-sky-900'],
                ['exempt', '면세', 'border-emerald-300 bg-emerald-50 text-emerald-900'],
              ] as const).map(([id, label, on]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={taxKind === id}
                  disabled={busy || !enabled}
                  className={`min-h-10 rounded-lg border px-3 text-fluid-sm font-semibold disabled:opacity-60 ${taxKind === id ? on : 'border-slate-300 bg-white text-slate-700'}`}
                  onClick={() => {
                    if (id !== taxKind) save({ taxKind: id });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <p className="text-fluid-2xs text-slate-500">바꾸면 바로 저장돼요. 팀장별로 끄기는 사용자 등록 › 팀장에서 해요.</p>
      {error ? <p className="text-fluid-2xs text-red-700">{error}</p> : null}
    </fieldset>
  );
}
