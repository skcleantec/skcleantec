import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getScheduleStaffNoticeBoard,
  putScheduleStaffNoticeBoard,
  type ScheduleStaffNoticeBoardDto,
} from '../../api/schedule';
import { useScheduleStaffNoticeBoardRealtime } from '../../hooks/useInboxRealtime';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

const MAX_LEN = 4000;

type Props = {
  token: string;
  canEdit: boolean;
};

export function ScheduleStaffNoticeBoardPanel({ token, canEdit }: Props) {
  const [remote, setRemote] = useState<ScheduleStaffNoticeBoardDto | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);

  const loadBoard = useCallback(
    async (silent = false) => {
      const seq = ++fetchSeq.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getScheduleStaffNoticeBoard(token);
        if (seq !== fetchSeq.current) return;
        setRemote(data);
        setDraft(data.body);
      } catch (e) {
        if (seq !== fetchSeq.current) return;
        setError(e instanceof Error ? e.message : '공유 메모를 불러올 수 없습니다.');
      } finally {
        if (seq === fetchSeq.current && !silent) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadBoard(false);
  }, [loadBoard]);

  useScheduleStaffNoticeBoardRealtime(
    token,
    () => {
      void loadBoard(true);
    },
    Boolean(token),
  );

  const hasMemo = (remote?.body ?? '').trim().length > 0;
  const dirty = canEdit && draft !== (remote?.body ?? '');

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await putScheduleStaffNoticeBoard(token, { body: draft });
      setRemote(saved);
      setDraft(saved.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : '공유 메모 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative rounded-lg border border-amber-200/90 bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-50 px-3 pb-2.5 pt-3 shadow-[2px_3px_10px_rgba(120,90,20,0.12)]">
      <div
        className="pointer-events-none absolute -top-1 left-1/2 h-2.5 w-12 -translate-x-1/2 rounded-sm bg-amber-200/70 shadow-sm"
        aria-hidden
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-fluid-xs font-semibold text-amber-950">공유 메모</p>
        {hasMemo ? (
          <span className="inline-flex items-center rounded-full bg-amber-600/90 px-1.5 py-px text-[10px] font-semibold text-white leading-none">
            공지
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="min-h-[176px] text-fluid-xs text-amber-900/70 py-2">불러오는 중…</p>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => {
              if (!canEdit) return;
              setDraft(e.target.value.slice(0, MAX_LEN));
            }}
            rows={8}
            readOnly={!canEdit}
            disabled={saving}
            placeholder="예: 이번 주 배정 원칙, 인원 부족 안내 등"
            className="w-full rounded-md border border-amber-200/80 bg-yellow-50/80 px-2.5 py-2 text-fluid-xs text-slate-800 placeholder:text-amber-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-1 min-h-[176px] resize-y read-only:cursor-default read-only:opacity-90"
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-fluid-2xs text-amber-900/50 tabular-nums">
              {draft.length}/{MAX_LEN}
            </span>
            {remote?.updatedAt && remote.updatedBy ? (
              <span className="text-fluid-2xs text-amber-900/70">
                {remote.updatedBy.name} · {formatDateTimeCompactWithWeekday(remote.updatedAt)}
              </span>
            ) : null}
          </div>
          {error ? <p className="mt-1 text-fluid-2xs text-rose-700">{error}</p> : null}
          {canEdit ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={saving || !dirty}
                onClick={() => void handleSave()}
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
