import { useEffect, useState } from 'react';
import { getFormConfig, updateFormConfig } from '../../../api/orderform';
import { HelpTooltip } from '../../ui/HelpTooltip';
import {
  DEFAULT_ORDER_FORM_FILL_RULES,
  ISSUE_FILL_RULES_PAGE_HELP,
  ORDER_FORM_FILL_RULE_FIELDS,
  mergeOrderFormFillRules,
  sanitizeOrderFormFillRulesForSave,
  type OrderFormFillRuleFlags,
  type OrderFormFillRuleKey,
  type OrderFormFillRules,
} from '@shared/orderFormFillRules';

const CHECK =
  'h-4 w-4 rounded border-slate-300 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const SAVE_BTN =
  'rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Props = {
  token: string;
  canSave: boolean;
  /** 모달 헤더가 제목을 맡을 때 */
  hideTitle?: boolean;
};

export function IssueFillRulesSettingsPanel({ token, canSave, hideTitle }: Props) {
  const [rules, setRules] = useState<OrderFormFillRules>(DEFAULT_ORDER_FORM_FILL_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFormConfig(token)
      .then((cfg) => {
        if (cancelled) return;
        setRules(mergeOrderFormFillRules(cfg.issueFillRules));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.');
        setRules(DEFAULT_ORDER_FORM_FILL_RULES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setFlag = (key: OrderFormFillRuleKey, field: keyof OrderFormFillRuleFlags, on: boolean) => {
    setRules((prev) => ({ ...prev, [key]: { ...prev[key], [field]: on } }));
    setSavedHint(null);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      await updateFormConfig(token, {
        issueFillRules: sanitizeOrderFormFillRulesForSave(rules),
      });
      setSavedHint('저장했습니다. 다음 발급부터 적용됩니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {hideTitle ? null : (
        <div className="flex items-start gap-2">
          <h3 className="text-fluid-sm font-semibold text-slate-900">작성 설정</h3>
          <HelpTooltip className="mt-0.5 shrink-0" text={ISSUE_FILL_RULES_PAGE_HELP} />
        </div>
      )}
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-amber-950">
        면적(공급·전용)은 고객이 구분하기 어렵습니다. 기본은 상담사가 적어야 발급됩니다. 체크는 지금 발주서와 같게
        맞춰 두었습니다.
      </p>
      {error ? <p className="text-fluid-xs text-rose-700">{error}</p> : null}
      {savedHint ? <p className="text-fluid-xs text-emerald-800">{savedHint}</p> : null}
      {loading ? (
        <p className="py-6 text-center text-fluid-sm text-slate-500">설정을 불러오는 중…</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full table-fixed border-collapse text-fluid-xs">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-2 py-2 text-center font-medium text-slate-600">항목</th>
                  <th className="px-2 py-2 text-center font-medium text-slate-600">고객</th>
                  <th className="px-2 py-2 text-center font-medium text-slate-600">마케터</th>
                  <th className="px-2 py-2 text-center font-medium text-slate-600">필수</th>
                </tr>
              </thead>
              <tbody>
                {ORDER_FORM_FILL_RULE_FIELDS.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-center">
                      <span className="inline-flex items-center justify-center gap-1">
                        <span className="truncate" title={row.label}>
                          {row.label}
                        </span>
                        <HelpTooltip className="shrink-0" text={row.help} />
                      </span>
                    </td>
                    {(['customer', 'marketer', 'required'] as const).map((field) => (
                      <td key={field} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className={CHECK}
                          checked={rules[row.key][field]}
                          disabled={!canSave}
                          onChange={(e) => setFlag(row.key, field, e.target.checked)}
                          aria-label={`${row.label} ${field === 'customer' ? '고객' : field === 'marketer' ? '마케터' : '필수'}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5 lg:hidden">
            {ORDER_FORM_FILL_RULE_FIELDS.map((row) => (
              <div key={row.key} className="rounded-lg border border-slate-200 p-2">
                <div className="mb-1.5 flex items-center gap-1">
                  <p className="min-w-0 truncate text-fluid-xs font-medium text-slate-900">{row.label}</p>
                  <HelpTooltip className="shrink-0" text={row.help} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fluid-2xs text-slate-700">
                  {(['customer', 'marketer', 'required'] as const).map((field) => (
                    <label key={field} className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        className={CHECK}
                        checked={rules[row.key][field]}
                        disabled={!canSave}
                        onChange={(e) => setFlag(row.key, field, e.target.checked)}
                      />
                      {field === 'customer' ? '고객' : field === 'marketer' ? '마케터' : '필수'}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className={SAVE_BTN} disabled={!canSave || saving} onClick={() => void handleSave()}>
              {saving ? '저장 중…' : '저장'}
            </button>
            {!canSave ? (
              <p className="text-fluid-2xs text-slate-500">설정 변경은 관리자만 할 수 있습니다. 상담사는 보기만 됩니다.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
