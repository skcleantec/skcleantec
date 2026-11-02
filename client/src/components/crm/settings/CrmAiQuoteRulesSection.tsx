import { useCallback, useEffect, useState } from 'react';
import type {
  TelecrmAiQuote,
  TelecrmAiQuoteModelStatus,
  TelecrmAiQuoteRuleDto,
  TelecrmAiQuoteRuleExample,
  TelecrmAiQuoteRuleParseResult,
} from '@shared/telecrmQuoteCrewLearning';
import { getToken } from '../../../stores/auth';
import {
  deleteTelecrmAiQuoteRule,
  fetchTelecrmAiQuoteRules,
  fetchTelecrmAiQuoteStatus,
  parseTelecrmAiQuoteRule,
  previewTelecrmAiQuote,
  saveTelecrmAiQuoteRule,
  updateTelecrmAiQuoteRule,
} from '../../../api/telecrmQuoteCrewLearning';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import { useCrmPropertyChoiceOptions } from '../intake/useCrmPropertyChoiceOptions';
import { Button } from '../../ui/Button';
import { OnOffSwitch } from '../../ui/OnOffSwitch';
import { confirmDialog, toast } from '../../ui/Toast';
import { SettingsCard } from './DeletePasswordModal';
import { formatWon } from './telecrmSettingsUi';
import { crmFieldClass } from '../crmUi';

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function ExampleList({ examples, afterOnly = false }: { examples: TelecrmAiQuoteRuleExample[]; afterOnly?: boolean }) {
  if (examples.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {examples.map((ex) => {
        const changed = ex.beforeWon !== ex.afterWon;
        return (
          <li key={ex.label} className="flex items-center gap-2 tabular-nums">
            <span className="min-w-0 flex-1 truncate text-slate-600">{ex.label}</span>
            {!afterOnly ? (
              <span className={changed ? 'text-slate-400 line-through' : 'text-slate-500'}>
                {ex.beforeWon != null ? formatWon(ex.beforeWon) : '—'}
              </span>
            ) : null}
            {!afterOnly ? <span className="text-slate-400">→</span> : null}
            <span className={`font-semibold ${changed ? 'text-emerald-700' : 'text-slate-700'}`}>
              {ex.afterWon != null ? formatWon(ex.afterWon) : '—'}
            </span>
            {!changed && !afterOnly ? <span className="text-fluid-2xs text-slate-400">(그대로)</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** 설정 → AI 견적 학습 — 말로 가르치기 · 학습 상태 · 직접 물어보기 */
export function CrmAiQuoteRulesSection() {
  const token = getToken();
  const { activeOperatingCompanyId } = useCrmWorkBrand();
  const propertyOptions = useCrmPropertyChoiceOptions();
  const [status, setStatus] = useState<TelecrmAiQuoteModelStatus | null>(null);
  const [rules, setRules] = useState<TelecrmAiQuoteRuleDto[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<TelecrmAiQuoteRuleParseResult | null>(null);
  const [learned, setLearned] = useState<{ summary: string; examples: TelecrmAiQuoteRuleExample[] } | null>(null);
  const [ask, setAsk] = useState({ pyeong: '', rooms: '', baths: '', balc: '', type: '', oneRoom: false });
  const [answer, setAnswer] = useState<TelecrmAiQuote | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, r] = await Promise.all([
        fetchTelecrmAiQuoteStatus(token, activeOperatingCompanyId),
        fetchTelecrmAiQuoteRules(token),
      ]);
      setStatus(s);
      setRules(r.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI 견적 정보를 불러오지 못했어요.');
    }
  }, [token, activeOperatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teach = async () => {
    if (!token || !text.trim()) return;
    setBusy(true);
    setParsed(null);
    setLearned(null);
    try {
      setParsed(await parseTelecrmAiQuoteRule(token, text.trim(), activeOperatingCompanyId));
    } catch (e) {
      setParsed({ ok: false, reason: e instanceof Error ? e.message : 'AI가 알아듣지 못했어요.' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!token || !parsed?.ok) return;
    setBusy(true);
    try {
      const res = await saveTelecrmAiQuoteRule(token, {
        text: text.trim(),
        spec: parsed.spec,
        operatingCompanyId: activeOperatingCompanyId,
      });
      setLearned({ summary: res.rule.summary, examples: res.examples });
      setStatus(res.status);
      setRules((prev) => [...prev, res.rule]);
      setParsed(null);
      setText('');
      toast.success('배웠어요! 다음 견적부터 바로 적용돼요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (rule: TelecrmAiQuoteRuleDto, next: boolean) => {
    if (!token) return;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: next } : r)));
    try {
      const res = await updateTelecrmAiQuoteRule(token, rule.id, { isActive: next });
      setStatus(res.status);
      toast.success(next ? '규칙을 켰어요 — 다음 견적부터 적용돼요.' : '규칙을 껐어요 — 다음 견적부터 빠져요.');
    } catch (e) {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !next } : r)));
      toast.error(e instanceof Error ? e.message : '바꾸지 못했어요.');
    }
  };

  const remove = async (rule: TelecrmAiQuoteRuleDto) => {
    if (!token) return;
    const ok = await confirmDialog({
      title: '이 규칙을 지울까요?',
      body: `「${rule.text}」\n지우면 AI 견적이 이 규칙 없이 계산돼요.`,
      confirmLabel: '지우기',
    });
    if (!ok) return;
    try {
      const res = await deleteTelecrmAiQuoteRule(token, rule.id);
      setStatus(res.status);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success('규칙을 지웠어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '지우지 못했어요.');
    }
  };

  const askQuote = async () => {
    if (!token) return;
    const pyeong = Number(ask.pyeong);
    if (!Number.isFinite(pyeong) || pyeong <= 0) {
      toast.error('평수를 넣어 주세요.');
      return;
    }
    const n = (v: string) => (v.trim() === '' ? null : Number(v));
    try {
      const res = await previewTelecrmAiQuote(token, {
        pyeong,
        roomCount: n(ask.rooms),
        bathroomCount: n(ask.baths),
        balconyCount: n(ask.balc),
        isOneRoom: ask.oneRoom,
        propertyType: ask.type || null,
        operatingCompanyId: activeOperatingCompanyId,
      });
      setAnswer(res.quote);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '계산하지 못했어요.');
    }
  };

  const smallField = `${crmFieldClass} h-8 !py-1 tabular-nums`;

  return (
    <SettingsCard title="AI 견적 가르치기">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-fluid-xs text-slate-700">
        <span className="font-semibold text-slate-900">지금 AI 견적</span>
        <span className="ml-2">
          마지막 학습 {fmtWhen(status?.trainedAt)} · 예약 {(status?.sampleCount ?? 0).toLocaleString('ko-KR')}건으로 배움 ·
          말로 넣은 규칙 {status?.activeRuleCount ?? 0}개 켜짐
          {status && status.ruleCount > status.activeRuleCount ? ` (꺼짐 ${status.ruleCount - status.activeRuleCount}개)` : ''}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-fluid-xs text-slate-600">
          가격 기준을 말로 적으면 AI가 규칙으로 바꿔서 보여줘요. 확인하고 「이대로 배우기」를 누르면 다음 견적부터 바로 적용돼요.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="예) 방 3개 화장실 2개 집은 평수가 작아도 최소 25만원은 받아"
          className={crmFieldClass}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="primary" disabled={busy || !text.trim()} onClick={() => void teach()}>
            {busy && !parsed ? 'AI가 읽는 중…' : 'AI에게 알려주기'}
          </Button>
        </div>

        {parsed?.ok ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-950">
            <p className="font-semibold">이렇게 이해했어요</p>
            {parsed.understood.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {parsed.examples.length > 0 ? (
              <div className="mt-1.5">
                <p className="text-fluid-2xs font-semibold text-slate-600">넣으면 이렇게 바뀌어요</p>
                <ExampleList examples={parsed.examples} />
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void save()}>
                이대로 배우기
              </Button>
              <Button size="sm" onClick={() => setParsed(null)}>
                다시 적기
              </Button>
            </div>
          </div>
        ) : parsed && !parsed.ok ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900">
            🤔 {parsed.reason}
          </p>
        ) : null}

        {learned ? (
          <div className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-fluid-xs">
            <p className="font-semibold text-emerald-800">✓ 배웠어요 — 「{learned.summary}」</p>
            <p className="text-slate-600">지금부터 이렇게 계산해요:</p>
            <ExampleList examples={learned.examples} afterOnly />
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-fluid-xs font-semibold text-slate-800">배운 규칙 (위에서부터 적용)</p>
        {rules.length === 0 ? (
          <p className="text-fluid-2xs text-slate-500">아직 말로 넣은 규칙이 없어요. 지금은 예약 데이터로만 계산해요.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2 py-2">
                <OnOffSwitch checked={rule.isActive} onChange={(next) => void toggle(rule, next)} showState={false} />
                <div className={`min-w-0 flex-1 text-fluid-xs ${rule.isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                  <p className="font-medium">{rule.summary}</p>
                  <p className="truncate text-fluid-2xs text-slate-500" title={rule.text}>
                    「{rule.text}」 · {rule.createdByName ?? '—'} · {fmtWhen(rule.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="quiet" className="!h-6 shrink-0 text-rose-600" onClick={() => void remove(rule)}>
                  지우기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-1.5 text-fluid-xs font-semibold text-slate-800">직접 물어보기 — 이 집이면 AI 견적은?</p>
        <div className="flex flex-wrap items-end gap-1.5 text-fluid-2xs text-slate-600">
          <label className="w-16">
            평수
            <input className={smallField} inputMode="numeric" value={ask.pyeong} onChange={(e) => setAsk({ ...ask, pyeong: e.target.value })} />
          </label>
          <label className="w-14">
            방
            <input className={smallField} inputMode="numeric" value={ask.rooms} onChange={(e) => setAsk({ ...ask, rooms: e.target.value })} />
          </label>
          <label className="w-14">
            화장실
            <input className={smallField} inputMode="numeric" value={ask.baths} onChange={(e) => setAsk({ ...ask, baths: e.target.value })} />
          </label>
          <label className="w-14">
            베란다
            <input className={smallField} inputMode="numeric" value={ask.balc} onChange={(e) => setAsk({ ...ask, balc: e.target.value })} />
          </label>
          <label className="w-28">
            건물 유형
            <select className={smallField} value={ask.type} onChange={(e) => setAsk({ ...ask, type: e.target.value })}>
              <option value="">상관없음</option>
              {propertyOptions.propertyTypes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <OnOffSwitch checked={ask.oneRoom} onChange={(next) => setAsk({ ...ask, oneRoom: next })} label="원룸" showState={false} />
          <Button size="sm" variant="primary" onClick={() => void askQuote()}>
            계산
          </Button>
        </div>
        {answer !== undefined ? (
          answer ? (
            <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-fluid-xs">
              <p>
                <span className="font-semibold">AI 견적</span>{' '}
                <span className="text-fluid-base font-bold tabular-nums text-slate-900">{formatWon(answer.amountWon)}</span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {answer.parts.map((part, i) => (
                  <li key={`${part.label}-${i}`} className="flex gap-2 tabular-nums text-slate-700">
                    <span className="min-w-0 flex-1 truncate">
                      {part.rule ? '📌 ' : ''}
                      {part.label}
                    </span>
                    <span className="font-semibold">
                      {i === 0 ? formatWon(part.amountWon) : `${part.amountWon > 0 ? '+' : '−'}${formatWon(Math.abs(part.amountWon))}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-fluid-2xs text-slate-500">배울 예약이 없어 계산할 수 없어요.</p>
          )
        ) : null}
      </div>
    </SettingsCard>
  );
}
