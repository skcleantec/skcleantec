import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getScheduleStaffNoticeBoard,
  putScheduleStaffNoticeBoard,
  putScheduleStaffNoticeBoardHeight,
  type ScheduleStaffNoticeBoardDto,
} from '../../api/schedule';
import { useScheduleStaffNoticeBoardRealtime } from '../../hooks/useInboxRealtime';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

const MAX_LEN = 4000;
const HEIGHT_DEFAULT = 176;
const HEIGHT_MIN = 120;
const HEIGHT_MAX = 640;

function clampHeight(px: number): number {
  if (!Number.isFinite(px)) return HEIGHT_DEFAULT;
  return Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, Math.round(px)));
}

type Props = {
  token: string;
  canEdit: boolean;
  /** 관리자만 세로 길이를 바꿔 저장한다. */
  canResize: boolean;
};

export function ScheduleStaffNoticeBoardPanel({ token, canEdit, canResize }: Props) {
  const [remote, setRemote] = useState<ScheduleStaffNoticeBoardDto | null>(null);
  const [draft, setDraft] = useState('');
  const [heightPx, setHeightPx] = useState(HEIGHT_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingHeight, setSavingHeight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);
  const draftRef = useRef(draft);
  const remoteBodyRef = useRef('');
  const savedHeightRef = useRef(HEIGHT_DEFAULT);
  const draggingRef = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  draftRef.current = draft;
  remoteBodyRef.current = remote?.body ?? '';
  savedHeightRef.current = clampHeight(remote?.bodyHeightPx ?? HEIGHT_DEFAULT);

  const loadBoard = useCallback(
    async (silent = false) => {
      const seq = ++fetchSeq.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getScheduleStaffNoticeBoard(token);
        if (seq !== fetchSeq.current) return;
        setRemote(data);
        if (!draggingRef.current) setHeightPx(clampHeight(data.bodyHeightPx));
        if (draftRef.current === remoteBodyRef.current) setDraft(data.body);
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

  useEffect(() => () => dragCleanupRef.current?.(), []);

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
      if (!draggingRef.current) setHeightPx(clampHeight(saved.bodyHeightPx));
    } catch (e) {
      setError(e instanceof Error ? e.message : '공유 메모 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const persistHeight = async (next: number) => {
    if (!canResize) return;
    const savedHeight = savedHeightRef.current;
    if (next === savedHeight) return;
    setSavingHeight(true);
    setError(null);
    try {
      const saved = await putScheduleStaffNoticeBoardHeight(token, next);
      setRemote(saved);
      if (!draggingRef.current) setHeightPx(clampHeight(saved.bodyHeightPx));
    } catch (e) {
      setHeightPx(savedHeight);
      setError(e instanceof Error ? e.message : '높이 저장에 실패했습니다.');
    } finally {
      setSavingHeight(false);
    }
  };

  const onResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canResize || savingHeight) return;
    event.preventDefault();
    const startY = event.clientY;
    const startH = heightPx;
    draggingRef.current = true;
    const move = (ev: PointerEvent) => {
      setHeightPx(clampHeight(startH + (ev.clientY - startY)));
    };
    const up = (ev: PointerEvent) => {
      dragCleanupRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      draggingRef.current = false;
      const next = clampHeight(startH + (ev.clientY - startY));
      setHeightPx(next);
      void persistHeight(next);
    };
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="relative rounded-lg border border-amber-200/90 bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-50 px-3 pb-2.5 pt-3 shadow-[2px_3px_10px_rgba(120,90,20,0.12)]">
      <div
        className="pointer-events-none absolute -top-1 left-1/2 h-2.5 w-12 -translate-x-1/2 rounded-sm bg-amber-200/70 shadow-sm"
        aria-hidden
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-fluid-xs font-semibold text-amber-950">공유 메모</p>
        {hasMemo ? (
          <span className="inline-flex items-center rounded-full bg-amber-600/90 px-1.5 py-px text-[11px] font-semibold text-white leading-none">
            공지
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-fluid-xs text-amber-900/70 py-2" style={{ minHeight: heightPx }}>
          불러오는 중…
        </p>
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
            style={{ height: heightPx }}
            className="w-full resize-none overflow-y-auto rounded-md border border-amber-200/80 bg-yellow-50/80 px-2.5 py-2 text-fluid-xs text-slate-800 placeholder:text-amber-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-1 read-only:cursor-default read-only:opacity-90"
          />
          {canResize ? (
            <button
              type="button"
              aria-label="공유 메모 높이 조절"
              disabled={savingHeight}
              onPointerDown={onResizePointerDown}
              style={{ touchAction: 'none' }}
              className="mx-auto mt-1 flex h-6 w-full cursor-ns-resize items-center justify-center rounded-md hover:bg-amber-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="h-1 w-8 rounded-full bg-amber-400/90" aria-hidden />
            </button>
          ) : null}
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
