import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { getMyDayOffs, addDayOff, removeDayOff } from '../../api/dayoffs';
import { getTeamMe } from '../../api/team';
import { getTeamToken } from '../../stores/teamAuth';
import { teamPreviewDepsKey } from '../../utils/teamPreviewQuery';
import {
  TEAM_WEEKDAY_HEADERS,
  TeamBiLine,
  teamT,
} from '../../i18n/team/teamI18n';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** 달력 연·월과 동일한 로컬 달력일(YYYY-MM-DD). toISOString()은 KST에서 월 경계가 하루 밀립니다. */
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

function formatDateLabelYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return ymd;
  return `${y}년 ${m}월 ${d}일`;
}

function yearOptionLabel(y: number): string {
  const row = teamT('team.schedule.yearOption', { y: String(y) });
  return `${row.ko} · ${row.th}`;
}

function monthOptionLabel(mo: number): string {
  const row = teamT('team.schedule.monthOption', { m: String(mo) });
  return `${row.ko} · ${row.th}`;
}

type DayOffConfirmModal = { mode: 'add' | 'remove'; ymd: string } | null;

export function TeamDayOffsPage() {
  const token = getTeamToken();
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<DayOffConfirmModal>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [selfEditAllowed, setSelfEditAllowed] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  /** 느린 초기 GET이 저장 직후 상태를 덮어쓰지 않도록 요청 세대 구분 */
  const listFetchGenRef = useRef(0);

  useEffect(() => {
    if (!token) {
      setProfileReady(false);
      return;
    }
    setProfileReady(false);
    getTeamMe(token)
      .then((me: { role?: string; allowSelfDayOffEdit?: boolean }) => {
        if (me.role === 'TEAM_LEADER') setSelfEditAllowed(me.allowSelfDayOffEdit !== false);
        else setSelfEditAllowed(true);
      })
      .catch(() => {
        setSelfEditAllowed(false);
      })
      .finally(() => setProfileReady(true));
  }, [token, previewKey]);

  useEffect(() => {
    if (!token) return;
    listFetchGenRef.current += 1;
    const gen = listFetchGenRef.current;
    queueMicrotask(() => setLoading(true));
    const { start, end } = getMonthRange(year, month);
    getMyDayOffs(token, start, end)
      .then((res) => {
        if (listFetchGenRef.current !== gen) return;
        setDayOffDates(new Set(res.items));
      })
      .catch(() => {
        if (listFetchGenRef.current !== gen) return;
        setDayOffDates(new Set());
      })
      .finally(() => {
        if (listFetchGenRef.current !== gen) return;
        setLoading(false);
      });
  }, [token, year, month, previewKey]);

  const getDateKey = (d: number) => {
    const m = month < 10 ? `0${month}` : `${month}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    return `${year}-${m}-${day}`;
  };

  const canInteract = profileReady && selfEditAllowed;

  const openDayOffConfirm = (d: number) => {
    if (!canInteract) return;
    const ymd = getDateKey(d);
    setConfirmModal({ mode: dayOffDates.has(ymd) ? 'remove' : 'add', ymd });
  };

  const handleConfirmDayOff = async () => {
    if (!token || !confirmModal) return;
    const { mode, ymd } = confirmModal;
    setConfirmBusy(true);
    try {
      listFetchGenRef.current += 1;
      const gen = listFetchGenRef.current;
      if (mode === 'remove') {
        await removeDayOff(token, ymd);
      } else {
        await addDayOff(token, ymd);
      }
      const { start, end } = getMonthRange(year, month);
      const res = await getMyDayOffs(token, start, end);
      if (listFetchGenRef.current !== gen) return;
      setDayOffDates(new Set(res.items));
      setConfirmModal(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  const calendarDays = getCalendarDays(year, month);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h1 className="text-xl font-semibold text-gray-800">
        <TeamBiLine id="team.dayoffs.pageTitle" koClassName="text-xl font-semibold text-gray-800" />
      </h1>
      <div className="text-sm text-gray-600">
        <TeamBiLine id="team.dayoffs.intro" koClassName="text-sm text-gray-600" />
      </div>

      {profileReady && !selfEditAllowed && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-fluid-sm text-amber-950"
          role="status"
        >
          <TeamBiLine id="team.dayoffs.selfEditDeniedLong" koClassName="text-fluid-sm text-amber-950" />
        </div>
      )}

      <div className="flex gap-2 items-center">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {yearOptionLabel(y)}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthOptionLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          <TeamBiLine id="team.common.loading" koClassName="text-sm text-gray-500" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 text-center text-xs">
            {TEAM_WEEKDAY_HEADERS.map((wh, wi) => (
              <div
                key={`${wh.ko}-${wi}`}
                className={`py-2 font-medium leading-tight ${wi === 6 ? 'text-blue-600' : 'text-gray-600'}`}
              >
                <span className="block">{wh.ko}</span>
                <span className={`block text-[10px] ${wi === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{wh.th}</span>
              </div>
            ))}
            {calendarDays.map((d, i) => {
              if (d === null) {
                return <div key={`e-${i}`} className="min-h-[44px] bg-gray-50" />;
              }
              const key = getDateKey(d);
              const isOff = dayOffDates.has(key);
              return (
                <div
                  key={key}
                  onClick={() => openDayOffConfirm(d)}
                  className={`min-h-[44px] py-2 border-b border-r border-gray-100 touch-manipulation ${
                    canInteract ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } ${isOff ? 'bg-red-100 text-red-700 font-medium' : canInteract ? 'hover:bg-gray-50' : ''}`}
                >
                  {d}
                  {isOff ? (
                    <span className="block text-[10px] leading-tight">
                      <TeamBiLine id="team.dayoffs.cellLabel" koClassName="text-[10px] leading-tight text-red-700" />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 flex items-start gap-1">
        <span className="inline-block w-4 h-4 bg-red-100 rounded shrink-0 mt-0.5 align-middle" />
        <TeamBiLine id="team.dayoffs.legendRed" koClassName="text-sm text-gray-500" />
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
              aria-labelledby="team-dayoff-confirm-title"
            >
              <h2 id="team-dayoff-confirm-title" className="text-lg font-semibold text-gray-900">
                {confirmModal.mode === 'add' ? (
                  <TeamBiLine id="team.dayoffs.confirmAddTitle" koClassName="text-lg font-semibold text-gray-900" />
                ) : (
                  <TeamBiLine id="team.dayoffs.confirmRemoveTitle" koClassName="text-lg font-semibold text-gray-900" />
                )}
              </h2>
              <p className="mt-2 text-fluid-sm text-gray-600">{formatDateLabelYmd(confirmModal.ymd)}</p>
              <div className="mt-1 text-fluid-xs text-gray-500">
                {confirmModal.mode === 'add' ? (
                  <TeamBiLine id="team.dayoffs.confirmAddHint" koClassName="text-fluid-xs text-gray-500" />
                ) : (
                  <TeamBiLine id="team.dayoffs.confirmRemoveHint" koClassName="text-fluid-xs text-gray-500" />
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-gray-300 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  <TeamBiLine id="team.dayoffs.no" koClassName="text-fluid-sm font-medium text-gray-800" />
                </button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={() => void handleConfirmDayOff()}
                  className="flex-1 min-h-[44px] rounded-xl bg-gray-900 text-fluid-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {confirmBusy ? (
                    <TeamBiLine id="team.modal.processing" koClassName="text-fluid-sm font-medium text-white" />
                  ) : (
                    <TeamBiLine id="team.dayoffs.yes" koClassName="text-fluid-sm font-medium text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
