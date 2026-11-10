import { useState } from 'react';
import { submitPublicHelpCmsFeedback } from '../../api/publicHelpCms';
import { HELP_HOME_CONTACT } from '@shared/helpHomeConfig';

type Props = {
  articleSlug: string;
  articleTitle: string;
  onAskInquiry: (prefill: { title: string; bodyHint: string }) => void;
};

export function HelpCmsArticleFeedbackBar({ articleSlug, articleTitle, onAskInquiry }: Props) {
  const [done, setDone] = useState<'yes' | 'no' | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async (helpful: boolean) => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await submitPublicHelpCmsFeedback(articleSlug, helpful);
      setDone(helpful ? 'yes' : 'no');
      if (r.alreadySubmitted) setMsg('오늘은 이미 남겨 주셨습니다. 감사합니다.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <p className="text-fluid-sm font-semibold text-slate-900">도움이 됐나요?</p>
      {done === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void send(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            네
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void send(false)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-fluid-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            아니요
          </button>
        </div>
      ) : done === 'yes' ? (
        <p className="mt-2 text-fluid-sm text-emerald-700">감사합니다. 더 쉽게 쓰시도록 돕겠습니다.</p>
      ) : (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-fluid-sm text-slate-700">
            무엇이 부족했나요? (선택)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-sm"
              placeholder="예: 화면 이름이 달라요, 사진이 더 필요해요"
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onAskInquiry({
                title: `도움말 보완 요청: ${articleTitle}`,
                bodyHint: [
                  `관련 글: ${articleTitle} (${articleSlug})`,
                  note.trim() ? `부족한 점: ${note.trim()}` : '',
                  '',
                  '어느 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어 주세요.',
                ]
                  .filter(Boolean)
                  .join('\n'),
              })
            }
            className="rounded-lg bg-sky-600 px-4 py-2 text-fluid-sm font-semibold text-white hover:bg-sky-700"
          >
            고객문의로 남기기
          </button>
        </div>
      )}
      {msg ? <p className="mt-2 text-fluid-2xs text-slate-500">{msg}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={() =>
            onAskInquiry({
              title: `문의: ${articleTitle}`,
              bodyHint: `관련 도움말: ${articleTitle} (/help article=${articleSlug})\n\n어느 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어 주세요.`,
            })
          }
          className="text-fluid-sm font-semibold text-sky-700 hover:underline"
        >
          그래도 모르겠으면 문의하기 →
        </button>
        <p className="mt-1 text-fluid-2xs text-slate-500">{HELP_HOME_CONTACT.hours}</p>
      </div>
    </div>
  );
}
