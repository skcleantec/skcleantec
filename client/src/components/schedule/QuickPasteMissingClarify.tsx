import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  askQuickPasteClarify,
  respondQuickPasteClarify,
  type QuickPasteClarifyAskResponse,
  type QuickPasteDraft,
  type QuickPasteFieldKey,
} from '../../api/quickPaste';

type ChatLine = { role: 'ai' | 'user' | 'learned'; text: string };

type QuickPasteMissingClarifyProps = {
  token: string;
  rawText: string;
  draft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  onDraftChange: (draft: QuickPasteDraft) => void;
};

function fieldStillMissing(draft: QuickPasteDraft, key: QuickPasteFieldKey): boolean {
  const v = draft[key];
  return v == null || (typeof v === 'string' && !String(v).trim());
}

export function QuickPasteMissingClarify({
  token,
  rawText,
  draft,
  missingFields,
  onDraftChange,
}: QuickPasteMissingClarifyProps) {
  const [skipped, setSkipped] = useState<QuickPasteFieldKey[]>([]);
  const [ask, setAsk] = useState<QuickPasteClarifyAskResponse | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [askToken, setAskToken] = useState(0);

  const activeKey = useMemo(() => {
    return missingFields.find((key) => fieldStillMissing(draft, key) && !skipped.includes(key)) ?? null;
  }, [draft, missingFields, skipped]);

  const loadQuestion = useCallback(async () => {
    if (!activeKey) return;
    setBusy(true);
    try {
      const q = await askQuickPasteClarify(token, rawText, draft, activeKey);
      setAsk(q);
      setLines([{ role: 'ai', text: q.question }]);
      setAnswer('');
    } catch (e) {
      setAsk(null);
      setLines([
        {
          role: 'ai',
          text: e instanceof Error ? e.message : '질문을 불러오지 못했습니다.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [activeKey, draft, rawText, token]);

  useEffect(() => {
    if (!activeKey) return;
    void loadQuestion();
  }, [activeKey, askToken, loadQuestion]);

  const submitAnswer = async () => {
    if (!activeKey || !answer.trim() || busy) return;
    const userText = answer.trim();
    setLines((prev) => [...prev, { role: 'user', text: userText }]);
    setAnswer('');
    setBusy(true);
    try {
      const result = await respondQuickPasteClarify(token, {
        rawText,
        draft,
        fieldKey: activeKey,
        userAnswer: userText,
        snippet: ask?.snippet ?? null,
        sourceLabel: ask?.sourceLabel ?? null,
      });
      onDraftChange(result.draft);
      setLines((prev) => [...prev, { role: 'learned', text: result.confirmation }]);
      window.setTimeout(() => {
        setAsk(null);
        setLines([]);
        setAskToken((t) => t + 1);
      }, 800);
    } catch (e) {
      setLines((prev) => [
        ...prev,
        { role: 'ai', text: e instanceof Error ? e.message : '학습에 실패했습니다.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const skipField = () => {
    if (!activeKey) return;
    setSkipped((prev) => [...prev, activeKey]);
    setAsk(null);
    setLines([]);
    setAnswer('');
    setAskToken((t) => t + 1);
  };

  if (!activeKey) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-3 space-y-3 shadow-sm">
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-fluid-xs font-semibold text-violet-950">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 text-[10px] font-bold text-white">
              AI
            </span>
            서식 학습
          </p>
          <p className="mt-1 text-fluid-2xs text-violet-800/90">
            원문 표기를 알려주시면 「{ask?.fieldLabel ?? activeKey}」 항목으로 기억합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={skipField}
          className="shrink-0 rounded-lg px-2 py-1 text-fluid-2xs text-slate-500 hover:bg-white/80 hover:text-slate-700"
        >
          건너뛰기
        </button>
      </div>

      {ask?.snippet ? (
        <pre className="relative max-h-24 overflow-auto rounded-xl border border-violet-100/80 bg-white/90 p-2.5 text-fluid-2xs text-slate-700 whitespace-pre-wrap shadow-sm">
          {ask.snippet}
        </pre>
      ) : null}

      <div className="relative space-y-2 max-h-40 overflow-y-auto">
        {lines.map((line, idx) => (
          <div
            key={`${line.role}-${idx}`}
            className={`rounded-xl px-2.5 py-2 text-fluid-2xs shadow-sm ${
              line.role === 'user'
                ? 'ml-6 bg-slate-900 text-white'
                : line.role === 'learned'
                  ? 'mr-4 border border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'mr-6 border border-violet-100 bg-white text-violet-950'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="relative flex gap-2">
        <input
          type="text"
          value={answer}
          disabled={busy}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitAnswer();
          }}
          placeholder="예: 예약자가 고객 이름 / 성함"
          className="min-h-10 flex-1 rounded-xl border border-violet-200 bg-white px-3 text-fluid-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          type="button"
          disabled={busy || !answer.trim()}
          onClick={() => void submitAnswer()}
          className="shrink-0 min-h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 text-fluid-xs font-semibold text-white shadow-md shadow-violet-500/25 disabled:opacity-50"
        >
          {busy ? '…' : '답변'}
        </button>
      </div>
    </div>
  );
}
