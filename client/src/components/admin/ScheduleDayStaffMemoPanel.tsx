import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getScheduleDayStaffMemo,
  putScheduleDayStaffMemo,
  type ScheduleDayStaffMemoDto,
} from '../../api/schedule';
import { useScheduleDayStaffMemoRealtime } from '../../hooks/useInboxRealtime';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

const MAX_LEN = 4000;

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type Props = {
  token: string;
  date: string;
};

export function ScheduleDayStaffMemoPanel({ token, date }: Props) {
  const [remote, setRemote] = useState<ScheduleDayStaffMemoDto | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  const loadMemo = useCallback(
    async (silent = false) => {
      const seq = ++fetchSeq.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getScheduleDayStaffMemo(token, date);
        if (seq !== fetchSeq.current) return;
        setRemote(data);
        setDraft(data.body);
      } catch (e) {
        if (seq !== fetchSeq.current) return;
        setError(e instanceof Error ? e.message : '메모를 불러올 수 없습니다.');
      } finally {
        if (seq === fetchSeq.current && !silent) setLoading(false);
      }
    },
    [token, date],
  );

  useEffect(() => {
    void loadMemo(false);
  }, [loadMemo]);

  useScheduleDayStaffMemoRealtime(
    token,
    (payload) => {
      if (payload.date === date) void loadMemo(true);
    },
    Boolean(token),
  );

  const hasMemo = (remote?.body ?? '').trim().length > 0;
  const dirty = draft !== (remote?.body ?? '');

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await putScheduleDayStaffMemo(token, { date, body: draft });
      setRemote(saved);
      setDraft(saved.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : '메모 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <details
      className={[
        'mb-3 rounded-lg border overflow-hidden shadow-sm [&_summary::-webkit-details-marker]:hidden',
        hasMemo ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <summary
        className={[
          'flex items-center justify-between gap-2 px-3 py-2.5 text-fluid-sm font-medium cursor-pointer list-none min-h-[44px] touch-manipulation',
          hasMemo
            ? 'text-sky-950 hover:bg-sky-50/80 active:bg-sky-100/60'
            : 'text-slate-800 hover:bg-slate-50 active:bg-slate-100',
        ].join(' ')}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span>당일 공유 메모</span>
          {hasMemo ? (
            <span className="inline-flex items-center rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white leading-none shrink-0">
              메모 있음
            </span>
          ) : null}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-slate-500 shrink-0 opacity-80" aria-hidden />
      </summary>

      <div className="px-3 pb-3 pt-2 border-t border-slate-100/80 bg-white/90 space-y-2">
        <p className="text-fluid-2xs text-slate-500 leading-snug">
          관리자·마케터가 공유하는 당일 메모입니다. 접수별 일정 메모와는 별도입니다.
        </p>

        {loading ? (
          <p className="text-fluid-xs text-slate-500 py-2">불러오는 중…</p>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              rows={4}
              disabled={saving}
              placeholder="예: 오늘 인원 부족, 특정 팀장 휴무 등 당일 공유 사항"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-fluid-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/80 min-h-[96px] resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-fluid-2xs text-slate-400 tabular-nums">
                {draft.length}/{MAX_LEN}
              </span>
              {remote?.updatedAt && remote.updatedBy ? (
                <span className="text-fluid-2xs text-slate-500">
                  {remote.updatedBy.name} · {formatDateTimeCompactWithWeekday(remote.updatedAt)}
                </span>
              ) : null}
            </div>
            {error ? <p className="text-fluid-xs text-rose-700">{error}</p> : null}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving || !dirty}
                onClick={() => void handleSave()}
                className="px-3 py-1.5 text-fluid-xs font-medium rounded-md border border-slate-800 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
