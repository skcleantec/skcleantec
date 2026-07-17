import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SoomgoInboxMessageRule, SoomgoInboxRuleAction } from '@shared/soomgoChatPreview';
import { getToken } from '../../../stores/auth';
import { parseJwtPayload } from '../../../utils/jwtPayload';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import { SettingsCard } from './DeletePasswordModal';
import {
  createSoomgoInboxMessageRule,
  loadSoomgoInboxRules,
  saveSoomgoInboxRules,
  subscribeSoomgoInboxRulesChanged,
} from '../../../utils/crmSoomgoInboxRules';

function RuleKeywordList({
  title,
  description,
  action,
  rules,
  busy,
  onRulesChange,
}: {
  title: string;
  description: string;
  action: SoomgoInboxRuleAction;
  rules: SoomgoInboxMessageRule[];
  busy: boolean;
  onRulesChange: (next: SoomgoInboxMessageRule[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const filtered = useMemo(() => rules.filter((row) => row.action === action), [action, rules]);

  const addKeyword = () => {
    const keyword = draft.trim();
    if (!keyword) return;
    const duplicate = rules.some(
      (row) => row.action === action && row.keyword.toLowerCase() === keyword.toLowerCase(),
    );
    if (duplicate) return;
    onRulesChange([...rules, createSoomgoInboxMessageRule(keyword, action)]);
    setDraft('');
  };

  const removeRule = (id: string) => {
    onRulesChange(rules.filter((row) => row.id !== id));
  };

  const toggleRule = (id: string) => {
    onRulesChange(
      rules.map((row) => (row.id === id ? { ...row, enabled: row.enabled === false } : row)),
    );
  };

  return (
    <SettingsCard title={title}>
      <p className="text-fluid-sm text-gray-500">{description}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          disabled={busy}
          placeholder="키워드 입력"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addKeyword();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={addKeyword}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white disabled:opacity-40"
        >
          추가
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-fluid-xs text-gray-400">등록된 키워드가 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
            >
              <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-slate-600">
                <input
                  type="checkbox"
                  checked={row.enabled !== false}
                  disabled={busy}
                  onChange={() => toggleRule(row.id)}
                  className="rounded border-slate-300"
                />
                사용
              </label>
              <span
                className={`min-w-0 flex-1 truncate text-fluid-sm font-medium ${
                  row.enabled === false ? 'text-slate-400 line-through' : 'text-slate-800'
                }`}
                title={row.keyword}
              >
                {row.keyword}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeRule(row.id)}
                className="shrink-0 rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}

/** 숨고 알림함 — 제외·강조 키워드 (브라우저·브랜드별 저장) */
export function TelecrmSoomgoInboxRulesSection() {
  const { active: workBrandActive } = useCrmWorkBrand();
  const brandSlug = workBrandActive?.slug ?? null;
  const userId = useMemo(() => {
    const token = getToken();
    if (!token) return null;
    return parseJwtPayload<{ userId?: string }>(token)?.userId ?? null;
  }, []);

  const [rules, setRules] = useState<SoomgoInboxMessageRule[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!userId) {
      setRules([]);
      return;
    }
    setRules(loadSoomgoInboxRules(userId, brandSlug));
  }, [brandSlug, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    return subscribeSoomgoInboxRulesChanged((detail) => {
      if (detail.userId !== userId) return;
      if ((detail.brandSlug ?? null) !== brandSlug) return;
      reload();
    });
  }, [brandSlug, reload, userId]);

  const persist = (next: SoomgoInboxMessageRule[]) => {
    if (!userId) return;
    setRules(next);
    saveSoomgoInboxRules(userId, brandSlug, next);
    setMsg('저장했습니다. 알림함에 바로 반영됩니다.');
    window.setTimeout(() => setMsg(null), 3000);
  };

  if (!userId) {
    return <p className="text-fluid-sm text-gray-500">로그인 후 설정할 수 있습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">
          {msg}
        </p>
      ) : null}
      <p className="text-fluid-sm text-gray-500">
        메시지 미리보기에 키워드가 <strong className="font-medium text-slate-700">부분 일치</strong>하면
        규칙이 적용됩니다. 설정은 이 PC·브라우저에 저장되며, 작업 브랜드(
        {workBrandActive?.displayName?.trim() || workBrandActive?.name?.trim() || '기본'})별로 구분됩니다.
      </p>
      <RuleKeywordList
        title="알림 제외 키워드"
        description="목록에 넣지 않고 토스트 알림도 띄우지 않습니다. (상단 고정된 행은 유지)"
        action="exclude"
        rules={rules}
        busy={false}
        onRulesChange={persist}
      />
      <RuleKeywordList
        title="강조 키워드"
        description="알림함에서 배경·테두리로 눈에 띄게 표시합니다."
        action="highlight"
        rules={rules}
        busy={false}
        onRulesChange={persist}
      />
    </div>
  );
}
