import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleStatsByDate } from '../../api/dayoffs';
import {
  getTeamLeaderDayOffsForDate,
  putTeamLeaderDayOffsForDate,
  type TeamLeaderDayOffRow,
} from '../../api/dayoffs';
import { ModalCloseButton } from './ModalCloseButton';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

type Props = {
  open: boolean;
  onClose: () => void;
  dateYmd: string;
  token: string;
  stats: ScheduleStatsByDate | undefined;
  onSaved: () => void;
};

export function ScheduleDayTeamLeaderAdjustModal({
  open,
  onClose,
  dateYmd,
  token,
  stats,
  onSaved,
}: Props) {
  const [leaders, setLeaders] = useState<TeamLeaderDayOffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !dateYmd) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTeamLeaderDayOffsForDate(token, dateYmd);
      setLeaders(res.leaders);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, [token, dateYmd]);

  useEffect(() => {
    if (open && dateYmd) void load();
  }, [open, dateYmd, load]);

  const offCount = leaders.filter((l) => l.dayOff).length;
  const workingCount = leaders.length - offCount;

  const handleSave = async () => {
    if (!token || !dateYmd) return;
    setSaving(true);
    setError(null);
    try {
      await putTeamLeaderDayOffsForDate(token, {
        date: dateYmd,
        leaders: leaders.map((l) => ({ teamLeaderId: l.id, dayOff: l.dayOff })),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal
      aria-labelledby="schedule-team-leader-adjust-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[min(92vh,720px)] rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="schedule-team-leader-adjust-title" className="text-fluid-sm font-semibold text-gray-900">
              팀장조정
            </h2>
            <p className="text-fluid-2xs text-gray-500 mt-0.5 tabular-nums">{formatDateCompactWithWeekday(dateYmd)}</p>
          </div>
          <ModalCloseButton onClick={() => !saving && onClose()} />
        </div>

        {error ? (
          <div className="mx-4 mt-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 shrink-0">
            {error}
          </div>
        ) : null}

        <div className="px-4 pt-3 pb-2 text-fluid-2xs text-gray-600 leading-snug shrink-0">
          팀장을 <strong className="font-medium text-gray-800">휴무</strong>로 지정하면 해당일 오전·오후 슬롯에서
          제외됩니다. 팀장 본인 등록 휴무와 동일하게 스케줄·잔여 TO에 반영됩니다.
        </div>

        {stats ? (
          <div className="px-4 pb-3 flex flex-wrap gap-2 text-fluid-2xs shrink-0">
            <span className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-800 tabular-nums">
              오전 잔여 {stats.assignableMorning ?? 0}
            </span>
            <span className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-800 tabular-nums">
              오후 잔여 {stats.assignableAfternoonSlot ?? 0}
            </span>
            <span className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-950 tabular-nums">
              휴무 {stats.offCount ?? offCount}명
            </span>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">불러오는 중…</p>
          ) : leaders.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">해당일 근무 대상 팀장이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-fluid-2xs">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium">이름</th>
                    <th className="text-center py-2 px-2 w-20 font-medium">휴무</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="py-2 px-2 text-center text-gray-900">{l.name}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={l.dayOff}
                          disabled={saving}
                          onChange={(ev) =>
                            setLeaders((prev) =>
                              prev.map((x) => (x.id === l.id ? { ...x, dayOff: ev.target.checked } : x)),
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300"
                          aria-label={`${l.name} 휴무`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && leaders.length > 0 ? (
            <p className="mt-2 text-fluid-2xs text-gray-500 tabular-nums">
              근무 {workingCount}명 · 휴무 {offCount}명
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => !saving && onClose()}
            className="px-4 py-2 text-fluid-xs rounded border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={saving || loading || leaders.length === 0}
            onClick={() => void handleSave()}
            className="px-4 py-2 text-fluid-xs rounded bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
