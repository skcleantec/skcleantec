import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { addCrewDayOff, getCrewDayOffs, removeCrewDayOff } from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { isCrewGroupDayOffMode } from '@shared/crewGroupSettings';
import { CrewUiLine, crewText } from '../../i18n/crew/crewI18n';
import { useCrewUiLang } from '../../i18n/crew/crewUiLanguageContext';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function getMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const remainder = days.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) days.push(null);
  }
  return days;
}

type ConfirmModal = { mode: 'add' | 'remove'; ymd: string } | null;

export function CrewDayOffsPage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const lang = useCrewUiLang();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [memberId, setMemberId] = useState('');
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const listFetchGenRef = useRef(0);

  const mode = me?.group.availabilityMode ?? (me?.group.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF');
  const allowed =
    me &&
    isCrewGroupDayOffMode(mode) &&
    me.group.allowCrewDayOffEdit &&
    me.crewViewerRole === 'LEADER';

  const members = useMemo(
    () => (me?.group.members ?? []).filter((m) => m.isActive),
    [me?.group.members],
  );

  useEffect(() => {
    if (!memberId && members.length > 0) {
      const leader = members.find((m) => m.isGroupLeader);
      setMemberId(leader?.teamMemberId ?? members[0].teamMemberId);
    }
  }, [members, memberId]);

  const loadMonth = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !memberId || !allowed) return;
    const gen = ++listFetchGenRef.current;
    setLoading(true);
    try {
      const { start, end } = getMonthRange(year, month);
      const r = await getCrewDayOffs(token, start, end);
      if (gen !== listFetchGenRef.current) return;
      const dates = r.byMember[memberId] ?? [];
      setDayOffDates(new Set(dates));
    } catch {
      if (gen === listFetchGenRef.current) setDayOffDates(new Set());
    } finally {
      if (gen === listFetchGenRef.current) setLoading(false);
    }
  }, [allowed, memberId, year, month]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  if (!me) {
    return (
      <div className="py-12 text-center text-gray-500 text-sm">
        <CrewUiLine id="crew.common.loading" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/crew" replace />;
  }

  const calendarDays = getCalendarDays(year, month);
  const canEdit = true;

  const getDateKey = (d: number) => `${year}-${pad2(month)}-${pad2(d)}`;

  const openConfirm = (d: number) => {
    if (!canEdit) return;
    const ymd = getDateKey(d);
    setConfirmModal({ mode: dayOffDates.has(ymd) ? 'remove' : 'add', ymd });
  };

  const handleConfirm = async () => {
    const token = getCrewToken();
    if (!token || !confirmModal || !memberId) return;
    setConfirmBusy(true);
    try {
      if (confirmModal.mode === 'add') {
        await addCrewDayOff(token, memberId, confirmModal.ymd);
        setDayOffDates((prev) => new Set([...prev, confirmModal.ymd]));
      } else {
        await removeCrewDayOff(token, memberId, confirmModal.ymd);
        setDayOffDates((prev) => {
          const next = new Set(prev);
          next.delete(confirmModal.ymd);
          return next;
        });
      }
      setConfirmModal(null);
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) throw e;
      alert(e instanceof Error ? e.message : '처리에 실패했습니다.');
    } finally {
      setConfirmBusy(false);
    }
  };

  const yearLabel = crewText('crew.dayoffs.yearOption', lang, { y: String(year) });
  const monthLabel = crewText('crew.dayoffs.monthOption', lang, { m: String(month) });

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h1 className="text-base font-semibold text-gray-900">
          <CrewUiLine id="crew.layout.navDayOffs" />
        </h1>
        <p className="text-fluid-xs text-gray-500 mt-1">
          <CrewUiLine id="crew.dayoffs.hint" />
        </p>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">
          <CrewUiLine id="crew.dayoffs.memberLabel" />
        </label>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded text-sm bg-white"
        >
          {members.map((m) => (
            <option key={m.teamMemberId} value={m.teamMemberId}>
              {m.name}
              {m.isGroupLeader ? ' ★' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          aria-label={yearLabel}
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i).map((y) => (
            <option key={y} value={y}>
              {crewText('crew.dayoffs.yearOption', lang, { y: String(y) })}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          aria-label={monthLabel}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
            <option key={mo} value={mo}>
              {crewText('crew.dayoffs.monthOption', lang, { m: String(mo) })}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          <CrewUiLine id="crew.common.loading" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 text-center text-xs">
            {WEEKDAY_KO.map((label, wi) => (
              <div
                key={label}
                className={`py-2 font-medium ${wi === 0 ? 'text-red-600' : wi === 6 ? 'text-blue-600' : 'text-gray-600'}`}
              >
                {label}
              </div>
            ))}
            {calendarDays.map((d, i) => {
              if (d === null) {
                return <div key={`e-${i}`} className="min-h-[44px] bg-gray-50" />;
              }
              const key = getDateKey(d);
              const isOff = dayOffDates.has(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => openConfirm(d)}
                  disabled={!canEdit}
                  className={`min-h-[44px] py-2 border-b border-r border-gray-100 touch-manipulation ${
                    canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60'
                  } ${isOff ? 'bg-red-100 text-red-700 font-medium' : ''}`}
                >
                  {d}
                  {isOff ? (
                    <span className="block text-[10px] leading-tight">
                      <CrewUiLine id="crew.dayoffs.cellLabel" className="text-[10px] text-red-700" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 flex items-start gap-1">
        <span className="inline-block w-4 h-4 bg-red-100 rounded shrink-0 mt-0.5" aria-hidden />
        <CrewUiLine id="crew.dayoffs.legendRed" className="text-sm text-gray-500" />
      </div>

      {confirmModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={() => !confirmBusy && setConfirmModal(null)}
            role="presentation"
          >
            <div
              className="w-full max-w-sm rounded-t-2xl border border-gray-200 bg-white p-6 shadow-xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                <CrewUiLine
                  id={confirmModal.mode === 'add' ? 'crew.dayoffs.confirmAddTitle' : 'crew.dayoffs.confirmRemoveTitle'}
                />
              </h2>
              <p className="mt-2 text-fluid-sm text-gray-600">{confirmModal.ymd}</p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-gray-300 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  <CrewUiLine id="crew.dayoffs.no" />
                </button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => void handleConfirm()}
                  className="flex-1 min-h-[44px] rounded-xl bg-gray-900 text-fluid-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {confirmBusy ? (
                    <CrewUiLine id="crew.common.loading" />
                  ) : (
                    <CrewUiLine id="crew.dayoffs.yes" />
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
