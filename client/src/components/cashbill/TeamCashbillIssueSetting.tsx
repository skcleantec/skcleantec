import { useEffect, useState } from 'react';
import { fetchTeamCashbillIssueSetting, saveTeamCashbillIssueSetting } from '../../api/cashbill';
import { teamFooterActionPrimaryClass, teamFooterActionSecondaryClass } from '../../utils/teamInspectionDisplay';

/** 계산서 연결 화면의 팀장 발행 허용. */
export function TeamCashbillIssueSetting({ canEdit = true }: { canEdit?: boolean }) {
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
        if (!stop) {
          setEnabled(res.enabled);
          setTaxKind(res.exemptLocked ? 'exempt' : res.taxKind === 'exempt' ? 'exempt' : 'taxable');
          setExemptLocked(Boolean(res.exemptLocked));
        }
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

  const toggle = () => {
    const next = !enabled;
    setSaving(true);
    setError(null);
    void saveTeamCashbillIssueSetting({ enabled: next })
      .then((res) => {
        setEnabled(res.enabled);
        setTaxKind(res.taxKind);
        setExemptLocked(res.exemptLocked);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '저장하지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  const pickTax = (next: 'taxable' | 'exempt') => {
    if (exemptLocked || next === taxKind) return;
    setSaving(true);
    setError(null);
    void saveTeamCashbillIssueSetting({ taxKind: next })
      .then((res) => {
        setTaxKind(res.exemptLocked ? 'exempt' : res.taxKind);
        setExemptLocked(res.exemptLocked);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '저장하지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-fluid-sm font-medium text-slate-900">팀장도 발행할 수 있게</p>
        <p className="text-fluid-2xs text-slate-500">현금영수증·세금계산서. 끄면 팀장 화면에서 사라집니다. 팀장별로도 끌 수 있습니다.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="팀장도 발행할 수 있게"
        disabled={loading || saving || !canEdit}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
          enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
          }`}
        />
      </button>
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2">
        <p className="text-fluid-sm font-medium text-slate-900">팀장 발행 기본 과세구분</p>
        {exemptLocked ? (
          <p className="mt-1 text-fluid-xs text-slate-600">면세 · 면세사업자는 면세로 고정됩니다.</p>
        ) : (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              aria-pressed={taxKind === 'taxable'}
              disabled={loading || saving || !canEdit}
              onClick={() => pickTax('taxable')}
              className={taxKind === 'taxable' ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}
            >
              과세
            </button>
            <button
              type="button"
              aria-pressed={taxKind === 'exempt'}
              disabled={loading || saving || !canEdit}
              onClick={() => pickTax('exempt')}
              className={taxKind === 'exempt' ? teamFooterActionPrimaryClass : teamFooterActionSecondaryClass}
            >
              면세
            </button>
          </div>
        )}
      </div>
      {error ? <p className="mt-2 text-fluid-2xs text-red-700">{error}</p> : null}
    </div>
  );
}
