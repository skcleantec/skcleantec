import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleStatsByDate } from '../../api/dayoffs';
import { putScheduleSlotToAdjustment } from '../../api/dayoffs';
import { ModalCloseButton } from './ModalCloseButton';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

const SLOT_ADJ_LIMIT = 300;

function formatAdjSigned(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : String(n);
}

export function ScheduleDaySlotToAdjustModal({
  open,
  onClose,
  dateYmd,
  token,
  stats,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  dateYmd: string;
  token: string;
  stats: ScheduleStatsByDate | undefined;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const amAdj = stats?.slotToMorningAdjustment ?? 0;
  const pmAdj = stats?.slotToAfternoonAdjustment ?? 0;
  const dispAm = stats?.assignableMorning ?? 0;
  const dispPm = stats?.assignableAfternoonSlot ?? 0;
  const compAm =
    stats?.computedAssignableMorning ?? dispAm - amAdj;
  const compPm =
    stats?.computedAssignableAfternoonSlot ?? dispPm - pmAdj;

  const persist = useCallback(
    async (nextAmAdj: number, nextPmAdj: number) => {
      const nm = Math.max(-SLOT_ADJ_LIMIT, Math.min(SLOT_ADJ_LIMIT, Math.trunc(nextAmAdj)));
      const np = Math.max(-SLOT_ADJ_LIMIT, Math.min(SLOT_ADJ_LIMIT, Math.trunc(nextPmAdj)));
      setBusy(true);
      try {
        await putScheduleSlotToAdjustment(token, {
          date: dateYmd,
          morningDelta: nm,
          afternoonDelta: np,
        });
        onSaved();
      } catch (e) {
        alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [token, dateYmd, onSaved]
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal
      aria-labelledby="schedule-slot-to-adjust-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <h2 id="schedule-slot-to-adjust-title" className="text-fluid-sm font-semibold text-gray-900">
            인원조정 · TO 표시 보정
          </h2>
          <ModalCloseButton onClick={() => !busy && onClose()} />
        </div>
        {!stats ? (
          <p className="px-4 py-6 text-fluid-sm text-gray-600">이 날짜의 스케줄 통계를 불러오지 못했습니다.</p>
        ) : (
          <>
            <p className="px-4 pt-3 text-fluid-xs text-gray-600 tabular-nums">
              {formatDateCompactWithWeekday(dateYmd)}
            </p>
            <p className="px-4 pb-3 text-fluid-2xs text-gray-500 leading-snug">
              캘린더·상세에 보이는 오전·오후 잔여 슬롯(TO) 숫자에 가산 보정을 적용합니다. 시스템 계산과 실제
              배정 가능이 다를 수 있습니다.
            </p>
            <div className="px-4 pb-4 space-y-4">
              <div>
                <div className="text-fluid-xs font-medium text-gray-800 mb-2">오전</div>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={busy || amAdj <= -SLOT_ADJ_LIMIT}
                    onClick={() => void persist(amAdj - 1, pmAdj)}
                    className="min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="오전 보정 감소"
                  >
                    −
                  </button>
                  <div className="min-w-[4.5rem] text-center">
                    <span
                      className={`text-xl font-bold tabular-nums ${
                        dispAm < 0 ? 'text-rose-700' : 'text-amber-950'
                      }`}
                    >
                      {dispAm}
                    </span>
                    <span className="block text-fluid-2xs text-gray-500 mt-0.5 tabular-nums">
                      계산 {compAm} · 보정 {formatAdjSigned(amAdj)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy || amAdj >= SLOT_ADJ_LIMIT}
                    onClick={() => void persist(amAdj + 1, pmAdj)}
                    className="min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="오전 보정 증가"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <div className="text-fluid-xs font-medium text-gray-800 mb-2">오후</div>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={busy || pmAdj <= -SLOT_ADJ_LIMIT}
                    onClick={() => void persist(amAdj, pmAdj - 1)}
                    className="min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="오후 보정 감소"
                  >
                    −
                  </button>
                  <div className="min-w-[4.5rem] text-center">
                    <span
                      className={`text-xl font-bold tabular-nums ${
                        dispPm < 0 ? 'text-rose-700' : 'text-sky-950'
                      }`}
                    >
                      {dispPm}
                    </span>
                    <span className="block text-fluid-2xs text-gray-500 mt-0.5 tabular-nums">
                      계산 {compPm} · 보정 {formatAdjSigned(pmAdj)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy || pmAdj >= SLOT_ADJ_LIMIT}
                    onClick={() => void persist(amAdj, pmAdj + 1)}
                    className="min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="오후 보정 증가"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                <button
                  type="button"
                  disabled={busy || (amAdj === 0 && pmAdj === 0)}
                  onClick={() => void persist(0, 0)}
                  className="px-3 py-1.5 text-fluid-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  보정 초기화
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => !busy && onClose()}
                  className="px-3 py-1.5 text-fluid-xs rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
