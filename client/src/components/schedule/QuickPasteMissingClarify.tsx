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
    <div className="rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50/80 to-white p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-fluid-xs font-semibold text-violet-900">AI 서식 학습</p>
          <p className="text-fluid-2xs text-violet-700/90">
            원문 표기를 알려주시면 「{ask?.fieldLabel ?? activeKey}」 항목으로 기억합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={skipField}
          className="shrink-0 text-fluid-2xs text-slate-500 hover:text-slate-700"
        >
          건너뛰기
        </button>
      </div>

      {ask?.snippet ? (
        <pre className="max-h-24 overflow-auto rounded-lg border border-violet-100 bg-white/90 p-2 text-fluid-2xs text-slate-700 whitespace-pre-wrap">
          {ask.snippet}
        </pre>
      ) : null}

      <div className="space-y-2 max-h-40 overflow-y-auto">
        {lines.map((line, idx) => (
          <div
            key={`${line.role}-${idx}`}
            className={`rounded-lg px-2.5 py-2 text-fluid-2xs ${
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

      <div className="flex gap-2">
        <input
          type="text"
          value={answer}
          disabled={busy}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitAnswer();
          }}
          placeholder="예: 예약자가 고객 이름 / 성함"
          className="min-h-10 flex-1 rounded-lg border border-violet-200 bg-white px-3 text-fluid-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          type="button"
          disabled={busy || !answer.trim()}
          onClick={() => void submitAnswer()}
          className="shrink-0 min-h-10 rounded-lg bg-violet-700 px-3 text-fluid-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : '답변'}
        </button>
      </div>
    </div>
  );
}
