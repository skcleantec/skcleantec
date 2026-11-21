import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TelecrmAiQuote,
  TelecrmAiQuoteChatReply,
  TelecrmAiQuoteModelStatus,
  TelecrmAiQuoteRuleDto,
  TelecrmAiQuoteRuleExample,
} from '@shared/telecrmQuoteCrewLearning';
import { getToken } from '../../../stores/auth';
import type { TelecrmAreaRuleDto } from '@shared/telecrmAreaResolve';
import {
  chatTelecrmAiQuoteRule,
  deleteTelecrmAiQuoteRule,
  deleteTelecrmAreaRule,
  fetchTelecrmAiQuoteRules,
  fetchTelecrmAiQuoteStatus,
  fetchTelecrmAreaRules,
  previewTelecrmAiQuote,
  saveTelecrmAiQuoteRule,
  saveTelecrmAreaRule,
  updateTelecrmAiQuoteRule,
  updateTelecrmAreaRule,
} from '../../../api/telecrmQuoteCrewLearning';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import { useCrmPropertyChoiceOptions } from '../intake/useCrmPropertyChoiceOptions';
import { Button } from '../../ui/Button';
import { OnOffSwitch } from '../../ui/OnOffSwitch';
import { confirmDialog, toast } from '../../ui/Toast';
import { DeletePasswordModal, SettingsCard } from './DeletePasswordModal';
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

type ChatTurn = {
  role: 'user' | 'ai';
  text: string;
  reply?: TelecrmAiQuoteChatReply;
  /** 이 답의 규칙을 배웠는지 */
  saved?: boolean;
  /** 배운 뒤 바뀐 금액 */
  learned?: TelecrmAiQuoteRuleExample[];
};

const GREETING: ChatTurn = {
  role: 'ai',
  text: '가격 기준이나 면적 기준을 말해 주세요. 애매하면 되물어볼게요.\n예) 방 3개 화장실 2개 집은 최소 25만원\n예) 아파트 고객이 22평이라고 하면 전용이에요',
};

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
  const [areaRules, setAreaRules] = useState<TelecrmAreaRuleDto[]>([]);
  const [areaCaseCount, setAreaCaseCount] = useState(0);
  const [areaDelete, setAreaDelete] = useState<TelecrmAreaRuleDto | null>(null);
  const [areaPassword, setAreaPassword] = useState('');
  const [areaPasswordError, setAreaPasswordError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  /** 대화 — 사람 말·AI 답 (AI 답에는 되묻기 선택지·규칙 초안·배운 결과가 붙음) */
  const [thread, setThread] = useState<ChatTurn[]>([GREETING]);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const [ask, setAsk] = useState({ pyeong: '', rooms: '', baths: '', balc: '', type: '', oneRoom: false });
  const [answer, setAnswer] = useState<TelecrmAiQuote | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, r, area] = await Promise.all([
        fetchTelecrmAiQuoteStatus(token, activeOperatingCompanyId),
        fetchTelecrmAiQuoteRules(token),
        fetchTelecrmAreaRules(token, activeOperatingCompanyId),
      ]);
      setStatus(s);
      setRules(r.items);
      setAreaRules(area.items);
      setAreaCaseCount(area.caseCount);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI 견적 정보를 불러오지 못했어요.');
    }
  }, [token, activeOperatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [thread]);

  const send = async (raw: string) => {
    const msg = raw.trim();
    if (!token || !msg || busy) return;
    const next: ChatTurn[] = [...thread, { role: 'user', text: msg }];
    setThread(next);
    setText('');
    setBusy(true);
    try {
      const history = next
        .filter((t) => t !== GREETING)
        .map((t) => ({ role: t.role, text: t.text }));
      const res = await chatTelecrmAiQuoteRule(token, history, activeOperatingCompanyId);
      setThread([...next, { role: 'ai', text: res.reply, reply: res }]);
    } catch (e) {
      setThread([...next, { role: 'ai', text: e instanceof Error ? e.message : 'AI가 답하지 못했어요. 다시 보내 주세요.' }]);
    } finally {
      setBusy(false);
    }
  };

  const learn = async (turnIndex: number) => {
    const turn = thread[turnIndex];
    if (!token || !turn?.reply || turn.reply.type !== 'rules' || turn.saved) return;
    const userWords = thread.filter((t) => t.role === 'user').map((t) => t.text);
    const sourceText = userWords.join(' / ').slice(0, 1800);
    setBusy(true);
    try {
      const after: TelecrmAiQuoteRuleExample[] = [];
      const savedRules: TelecrmAiQuoteRuleDto[] = [];
      let lastStatus: TelecrmAiQuoteModelStatus | null = null;
      for (const draft of turn.reply.rules) {
        const res = await saveTelecrmAiQuoteRule(token, {
          text: sourceText,
          spec: draft.spec,
          operatingCompanyId: activeOperatingCompanyId,
        });
        savedRules.push(res.rule);
        after.push(...res.examples);
        lastStatus = res.status;
      }
      if (lastStatus) setStatus(lastStatus);
      setRules((prev) => [...prev, ...savedRules]);
      setThread((prev) => [
        ...prev.map((t, i) => (i === turnIndex ? { ...t, saved: true } : t)),
        {
          role: 'ai',
          text: `✓ 배웠어요! 「${savedRules.map((r) => r.summary).join('」, 「')}」 — 다음 견적부터 이렇게 계산해요.`,
          learned: after,
        },
      ]);
      toast.success('배웠어요! 다음 견적부터 바로 적용돼요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const learnArea = async (turnIndex: number) => {
    const turn = thread[turnIndex];
    if (!token || !turn?.reply || turn.reply.type !== 'areaRules' || turn.saved) return;
    setBusy(true);
    try {
      const saved: TelecrmAreaRuleDto[] = [];
      for (const draft of turn.reply.rules) {
        const res = await saveTelecrmAreaRule(token, { spec: draft.spec, operatingCompanyId: activeOperatingCompanyId });
        saved.push(res.rule);
      }
      setAreaRules((prev) => [...prev, ...saved]);
      setThread((prev) => [
        ...prev.map((t, i) => (i === turnIndex ? { ...t, saved: true } : t)),
        { role: 'ai', text: `✓ 면적 기준을 배웠어요. 「${saved.map((row) => row.summary).join('」, 「')}」 — 다음 상담부터 바로 적용돼요.` },
      ]);
      toast.success('면적 기준을 배웠어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const toggleArea = async (rule: TelecrmAreaRuleDto, next: boolean) => {
    if (!token) return;
    setAreaRules((prev) => prev.map((row) => (row.id === rule.id ? { ...row, isActive: next } : row)));
    try {
      await updateTelecrmAreaRule(token, rule.id, { isActive: next }, activeOperatingCompanyId);
      toast.success(next ? '면적 기준을 켰어요.' : '면적 기준을 껐어요.');
    } catch (e) {
      setAreaRules((prev) => prev.map((row) => (row.id === rule.id ? { ...row, isActive: !next } : row)));
      toast.error(e instanceof Error ? e.message : '바꾸지 못했어요.');
    }
  };

  const removeArea = async () => {
    if (!token || !areaDelete) return;
    setBusy(true);
    setAreaPasswordError(null);
    try {
      await deleteTelecrmAreaRule(token, areaDelete.id, areaPassword);
      setAreaRules((prev) => prev.filter((row) => row.id !== areaDelete.id));
      setAreaDelete(null);
      setAreaPassword('');
      toast.success('면적 기준을 지웠어요.');
    } catch (e) {
      setAreaPasswordError(e instanceof Error ? e.message : '지우지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setThread([GREETING]);
    setText('');
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

      <div className="rounded-xl border border-slate-200">
        <div className="max-h-80 space-y-2 overflow-y-auto p-3">
          {thread.map((turn, i) =>
            turn.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-slate-900 px-3 py-1.5 text-fluid-xs text-white">
                  {turn.text}
                </p>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-slate-100 px-3 py-1.5 text-fluid-xs text-slate-800">
                  <p className="whitespace-pre-wrap">
                    <span className="mr-1">🤖</span>
                    {turn.text}
                  </p>
                  {turn.reply?.type === 'ask' && turn.reply.choices.length > 0 && i === thread.length - 1 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {turn.reply.choices.map((c) => (
                        <Button key={c} size="sm" className="!h-7" disabled={busy} onClick={() => void send(c)}>
                          {c}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {turn.reply?.type === 'areaRules' ? (
                    <div className="mt-1.5 space-y-1.5">
                      {turn.reply.rules.map((draft) => (
                        <div key={draft.spec.summary} className="rounded-lg border border-sky-200 bg-white px-2.5 py-1.5">
                          <p className="font-semibold text-sky-900">{draft.preview}</p>
                          {draft.examples.map((line) => (
                            <p key={line} className="text-slate-600">
                              {line}
                            </p>
                          ))}
                        </div>
                      ))}
                      {turn.saved ? (
                        <p className="text-fluid-2xs font-semibold text-sky-800">배운 면적 기준이에요</p>
                      ) : (
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => void learnArea(i)}>
                          이대로 배우기
                        </Button>
                      )}
                    </div>
                  ) : null}
                  {turn.reply?.type === 'rules' ? (
                    <div className="mt-1.5 space-y-1.5">
                      {turn.reply.rules.map((draft, k) => (
                        <div key={k} className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5">
                          <p className="font-semibold text-emerald-800">규칙 {k + 1} · {draft.spec.summary}</p>
                          {draft.understood.map((line) => (
                            <p key={line} className="text-slate-600">
                              {line}
                            </p>
                          ))}
                          {draft.examples.length > 0 ? (
                            <>
                              <p className="mt-1 text-fluid-2xs font-semibold text-slate-500">넣으면 이렇게 바뀌어요</p>
                              <ExampleList examples={draft.examples} />
                            </>
                          ) : null}
                        </div>
                      ))}
                      {turn.saved ? (
                        <p className="text-fluid-2xs font-semibold text-emerald-700">✓ 배운 규칙이에요</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="primary" disabled={busy} onClick={() => void learn(i)}>
                            {turn.reply.rules.length > 1 ? `${turn.reply.rules.length}개 다 배우기` : '이대로 배우기'}
                          </Button>
                          <span className="self-center text-fluid-2xs text-slate-500">다르면 아래에 고칠 점을 말해 주세요</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {turn.learned && turn.learned.length > 0 ? <ExampleList examples={turn.learned} afterOnly /> : null}
                </div>
              </div>
            ),
          )}
          {busy ? <p className="text-fluid-2xs text-slate-400">🤖 생각하는 중…</p> : null}
          <div ref={threadEndRef} />
        </div>
        <div className="flex items-end gap-1.5 border-t border-slate-200 p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(text);
              }
            }}
            rows={2}
            placeholder="가격 기준을 편하게 말해 주세요 (Enter 보내기, Shift+Enter 줄바꿈)"
            className={`${crmFieldClass} min-w-0 flex-1 resize-none`}
          />
          <div className="flex shrink-0 flex-col gap-1">
            <Button size="sm" variant="primary" disabled={busy || !text.trim()} onClick={() => void send(text)}>
              보내기
            </Button>
            {thread.length > 1 ? (
              <Button size="sm" variant="quiet" className="!h-6" onClick={restart}>
                새로 시작
              </Button>
            ) : null}
          </div>
        </div>
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

      <div>
        <p className="mb-1 text-fluid-xs font-semibold text-slate-800">면적 기준 · 쌓인 사례 {areaCaseCount}건</p>
        {areaRules.length === 0 ? (
          <p className="text-fluid-2xs text-slate-500">아직 배운 면적 기준이 없어요. 아파트는 공급, 그 외는 전용으로 봅니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {areaRules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2 py-2">
                <OnOffSwitch checked={rule.isActive} onChange={(next) => void toggleArea(rule, next)} showState={false} />
                <p className={`min-w-0 flex-1 text-fluid-xs ${rule.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{rule.summary}</p>
                <Button size="sm" variant="quiet" className="!h-6 shrink-0 text-rose-600" onClick={() => setAreaDelete(rule)}>
                  지우기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeletePasswordModal
        open={areaDelete != null}
        title="이 면적 기준을 지울까요?"
        description={areaDelete ? `「${areaDelete.summary}」` : undefined}
        busy={busy}
        password={areaPassword}
        error={areaPasswordError}
        onPasswordChange={setAreaPassword}
        onConfirm={() => void removeArea()}
        onClose={() => {
          setAreaDelete(null);
          setAreaPassword('');
          setAreaPasswordError(null);
        }}
      />

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
