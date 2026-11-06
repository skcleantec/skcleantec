import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import {
  getCrewDayRoster,
  putCrewDayRoster,
  type CrewMeResponse,
  type DayRosterItem,
} from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { CrewBiLine, CrewBiInline, useCrewText } from '../../i18n/crew/crewI18n';
import { CrewMemberNameLines } from '../../components/crew/CrewMemberNameLines';
import { confirmDialog, toast } from '../../components/ui/Toast';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** KST 달력 기준 이번 주(일~토)에서 ymd 다음 날부터 토요일까지 */
function restOfWeekYmds(ymd: string): string[] {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  const out: string[] = [];
  for (let i = 1; i <= 6 - dow; i++) out.push(addDaysYmd(ymd, i));
  return out;
}

function parseRosterRow(row: DayRosterItem | undefined): {
  ids: string[];
  standby: Set<string>;
  dayOff: Set<string>;
} {
  let ids: string[] = [];
  let standby = new Set<string>();
  if (row) {
    if (Array.isArray(row.members) && row.members.length > 0) {
      ids = row.members.map((m) => m.teamMemberId);
      standby = new Set(row.members.filter((m) => m.isStandby).map((m) => m.teamMemberId));
    } else if (Array.isArray(row.teamMemberIds)) {
      ids = row.teamMemberIds;
      standby = new Set(Array.isArray(row.standbyTeamMemberIds) ? row.standbyTeamMemberIds : []);
    }
  }
  const dayOff = new Set(Array.isArray(row?.dayOffTeamMemberIds) ? row!.dayOffTeamMemberIds! : []);
  return { ids, standby, dayOff };
}

type ApplyMode = 'none' | 'restWeek' | 'pick';

export function CrewRosterDayPage() {
  const { ymd } = useParams<{ ymd: string }>();
  const navigate = useNavigate();
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const reloadMe = outlet?.reloadMe;

  const [workingIds, setWorkingIds] = useState<Set<string>>(new Set());
  const [standbyIds, setStandbyIds] = useState<Set<string>>(new Set());
  const [dayOffIds, setDayOffIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [applyMode, setApplyMode] = useState<ApplyMode>('none');
  const [pickedDates, setPickedDates] = useState<Set<string>>(new Set());
  const [monthRosterDates, setMonthRosterDates] = useState<Set<string>>(new Set());
  const t = useCrewText();

  const canEdit = me?.crewViewerRole === 'LEADER';
  const needsSensitivePassword =
    Boolean(canEdit && me?.group.availabilityMode === 'ROSTER' && me?.group.hasSettingsPassword);
  const members: CrewMeResponse['group']['members'] = me?.group.members ?? [];

  const loadDay = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me || !ymd || !YMD_RE.test(ymd)) return;
    setLoading(true);
    try {
      const [y, m] = ymd.split('-').map(Number);
      const monthStart = `${y}-${pad2(m)}-01`;
      const monthEnd = `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`;
      const r = await getCrewDayRoster(token, monthStart, monthEnd);
      const items = Array.isArray(r.items) ? r.items : [];
      const row = items.find((it) => it && it.date === ymd);
      const parsed = parseRosterRow(row);
      setWorkingIds(new Set(parsed.ids));
      setStandbyIds(parsed.standby);
      setDayOffIds(parsed.dayOff);
      const withRoster = new Set<string>();
      for (const it of items) {
        if (!it?.date || !YMD_RE.test(it.date)) continue;
        const n =
          Array.isArray(it.members) && it.members.length > 0
            ? it.members.length
            : Array.isArray(it.teamMemberIds)
              ? it.teamMemberIds.length
              : 0;
        if (n > 0) withRoster.add(it.date);
      }
      setMonthRosterDates(withRoster);
    } catch {
      setWorkingIds(new Set());
      setStandbyIds(new Set());
      setDayOffIds(new Set());
      setMonthRosterDates(new Set());
    } finally {
      setLoading(false);
    }
  }, [me, ymd]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const poolMembers = useMemo(
    () => members.filter((m) => !workingIds.has(m.teamMemberId)),
    [members, workingIds],
  );
  const workingMembers = useMemo(
    () => members.filter((m) => workingIds.has(m.teamMemberId)),
    [members, workingIds],
  );
  const selectablePoolIds = useMemo(
    () => poolMembers.filter((m) => !dayOffIds.has(m.teamMemberId)).map((m) => m.teamMemberId),
    [poolMembers, dayOffIds],
  );

  const goCalendar = () => {
    navigate('/crew/roster');
  };

  const moveOneToWorking = (id: string) => {
    if (!canEdit || dayOffIds.has(id)) return;
    setWorkingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const moveOneToPool = (id: string) => {
    if (!canEdit) return;
    setWorkingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setStandbyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectAllPool = () => {
    if (!canEdit || selectablePoolIds.length === 0) return;
    setWorkingIds((prev) => {
      const next = new Set(prev);
      for (const id of selectablePoolIds) next.add(id);
      return next;
    });
  };

  const clearAllPool = () => {
    if (!canEdit) return;
    setWorkingIds(new Set());
    setStandbyIds(new Set());
  };

  const clearAllWorking = () => {
    if (!canEdit) return;
    setWorkingIds(new Set());
    setStandbyIds(new Set());
  };

  const selectAllWorking = () => {
    if (!canEdit) return;
    setWorkingIds(
      new Set(members.filter((m) => !dayOffIds.has(m.teamMemberId)).map((m) => m.teamMemberId)),
    );
  };

  const toggleStandby = (id: string) => {
    if (!canEdit) return;
    setStandbyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fillFromDate = async (sourceYmd: string) => {
    const token = getCrewToken();
    if (!token || !canEdit) return;
    try {
      const r = await getCrewDayRoster(token, sourceYmd, sourceYmd);
      const row = (Array.isArray(r.items) ? r.items : []).find((it) => it?.date === sourceYmd);
      const parsed = parseRosterRow(row);
      const next = new Set(parsed.ids.filter((id) => !dayOffIds.has(id)));
      if (next.size === 0 && parsed.ids.length === 0) {
        toast.info(t('crew.roster.copyEmpty'));
        return;
      }
      const nextStandby = new Set(
        [...parsed.standby].filter((id) => next.has(id) && !dayOffIds.has(id)),
      );
      setWorkingIds(next);
      setStandbyIds(nextStandby);
      toast.success(t('crew.roster.copyLoaded'));
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        toast.error({ title: t('crew.roster.alertSaveFail'), body: t('crew.roster.sessionExpired') });
        return;
      }
      toast.error(e instanceof Error ? e.message : t('crew.roster.alertSaveFail'));
    }
  };

  const targetApplyDates = useMemo(() => {
    if (!ymd || applyMode === 'none') return [] as string[];
    if (applyMode === 'restWeek') return restOfWeekYmds(ymd);
    return [...pickedDates].filter((d) => d !== ymd).sort();
  }, [ymd, applyMode, pickedDates]);

  const buildEntry = (date: string) => ({
    date,
    members: [...workingIds].map((teamMemberId) => ({
      teamMemberId,
      isStandby: standbyIds.has(teamMemberId),
    })),
  });

  const requestSave = () => {
    if (!canEdit || loading) return;
    if (needsSensitivePassword) {
      setModalPassword('');
      setPasswordModalOpen(true);
      return;
    }
    void performSave();
  };

  const performSave = async (settingsPassword?: string) => {
    const token = getCrewToken();
    if (!token || !canEdit || !ymd || !YMD_RE.test(ymd)) {
      toast.error(t('crew.roster.alertSaveSkipped'));
      return;
    }

    const extraDates = targetApplyDates;
    let occupied = extraDates.filter((d) => monthRosterDates.has(d));
    const unknownDates = extraDates.filter((d) => !monthRosterDates.has(d));
    if (unknownDates.length > 0) {
      try {
        const lo = [...unknownDates].sort()[0];
        const hi = [...unknownDates].sort()[unknownDates.length - 1];
        const r = await getCrewDayRoster(token, lo, hi);
        for (const it of Array.isArray(r.items) ? r.items : []) {
          if (!it?.date || !unknownDates.includes(it.date)) continue;
          const n =
            Array.isArray(it.members) && it.members.length > 0
              ? it.members.length
              : Array.isArray(it.teamMemberIds)
                ? it.teamMemberIds.length
                : 0;
          if (n > 0) occupied.push(it.date);
        }
      } catch {
        /* 확인 생략하고 저장 진행 */
      }
    }
    occupied = [...new Set(occupied)].sort();
    if (occupied.length > 0) {
      const ok = await confirmDialog({
        title: t('crew.roster.overwriteConfirmTitle'),
        body: t('crew.roster.overwriteConfirmBody', {
          dates: occupied.map((d) => d.slice(5)).join(', '),
        }),
        confirmLabel: t('crew.roster.overwriteConfirmOk'),
        cancelLabel: t('crew.roster.modalCancel'),
        danger: true,
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const entries = [buildEntry(ymd), ...extraDates.map((d) => buildEntry(d))];
      await putCrewDayRoster(token, entries, {
        settingsPassword: needsSensitivePassword ? settingsPassword : undefined,
      });
      await reloadMe?.();
      toast.success(t('crew.roster.alertSaved'));
      goCalendar();
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        toast.error({ title: t('crew.roster.alertSaveFail'), body: t('crew.roster.sessionExpired') });
        return;
      }
      const detail = e instanceof Error && e.message.trim() ? e.message.trim() : t('crew.roster.alertSaveFail');
      toast.error({ title: t('crew.roster.alertSaveFail'), body: detail });
    } finally {
      setSaving(false);
    }
  };

  const confirmPasswordModal = () => {
    const p = modalPassword.trim();
    if (!p) {
      toast.error(t('crew.roster.modalPasswordRequired'));
      return;
    }
    setPasswordModalOpen(false);
    setModalPassword('');
    void performSave(p);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setModalPassword('');
  };

  const pickMonthDays = useMemo(() => {
    if (!ymd) return [] as string[];
    const [y, m] = ymd.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= last; d++) {
      const key = `${y}-${pad2(m)}-${pad2(d)}`;
      if (key !== ymd) days.push(key);
    }
    return days;
  }, [ymd]);

  if (!outlet) {
    return (
      <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
        화면 레이아웃을 불러오지 못했습니다. 상단 「홈」을 누른 뒤 다시 시도하거나 페이지를 새로고침해 주세요.
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-sm text-gray-500">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  if (!ymd || !YMD_RE.test(ymd)) {
    return <Navigate to="/crew/roster" replace />;
  }

  const dateLine = formatDateCompactWithWeekday(ymd);
  const isToday = ymd === kstTodayYmd();

  const listBtn =
    'bg-white border-gray-200 text-gray-800 hover:bg-gray-50 active:bg-indigo-50';
  const standbyBtn = (on: boolean) =>
    on
      ? 'bg-amber-500 border-amber-600 text-white shadow-sm'
      : 'bg-white border-gray-300 text-gray-700 hover:bg-amber-50';

  const chipBtn =
    'px-2 py-1 text-[0.65rem] rounded border border-gray-300 bg-white text-gray-800 disabled:opacity-40';

  return (
    <div className="min-w-0 min-h-[60vh] flex flex-col">
      <div className="sticky top-0 z-20 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-2 mb-2 -mx-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={goCalendar}
            className="shrink-0 px-2 py-1 rounded border border-gray-300 bg-white text-gray-800 text-left leading-tight"
          >
            <span className="text-xs font-medium">←</span>
            <span className="block text-[0.6rem]">{t('crew.roster.backToCalendar')}</span>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="text-xs font-semibold text-gray-900 truncate tabular-nums">{dateLine}</div>
            {isToday ? (
              <div className="text-[0.6rem] text-indigo-700">
                <CrewBiLine id="crew.roster.todayBadge" />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={goCalendar}
            className="shrink-0 px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-600"
          >
            {t('crew.roster.close')}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg px-2 py-2 flex-1 min-w-0">
        <div className="flex items-start gap-1.5 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 min-w-0 flex-1">
            <CrewBiLine id="crew.roster.dayEditorTitle" koClassName="font-semibold" />
          </h2>
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-label={t('crew.roster.helpToggleAria')}
            onClick={() => setHelpOpen((v) => !v)}
            className="shrink-0 mt-0.5 w-6 h-6 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>
        </div>
        {helpOpen ? (
          <div className="mt-1.5 p-2 rounded-md border border-gray-200 bg-gray-50 text-[0.65rem] text-gray-600 leading-snug space-y-1">
            {canEdit ? <CrewBiLine id="crew.roster.dayEditorHintLeader" /> : <CrewBiLine id="crew.roster.hintView" />}
            {canEdit ? <CrewBiLine id="crew.roster.standbyHint" /> : null}
          </div>
        ) : null}

        {canEdit && !loading ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={chipBtn}
              disabled={saving}
              onClick={() => void fillFromDate(addDaysYmd(ymd, -1))}
            >
              {t('crew.roster.copyYesterday')}
            </button>
            <button
              type="button"
              className={chipBtn}
              disabled={saving}
              onClick={() => void fillFromDate(addDaysYmd(ymd, -7))}
            >
              {t('crew.roster.copySameWeekday')}
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-500 mt-3">
            <CrewBiLine id="crew.common.loading" />
          </p>
        ) : (
          <div className="mt-3 flex gap-1.5 sm:gap-2 min-h-0 min-w-0 items-stretch">
            <div className="flex-1 min-w-0 flex flex-col border border-gray-200 rounded-md overflow-hidden bg-gray-50/50">
              <div className="px-1.5 py-1 bg-gray-100 border-b border-gray-200 text-center">
                <CrewBiInline id="crew.roster.columnMembers" className="text-[0.65rem] font-medium text-gray-800" />
              </div>
              {canEdit ? (
                <div className="flex gap-1 px-1 py-1 border-b border-gray-200 bg-white">
                  <button
                    type="button"
                    className="flex-1 py-1 text-[0.6rem] rounded border border-gray-300 bg-white text-gray-800 disabled:opacity-40"
                    disabled={selectablePoolIds.length === 0 || saving}
                    onClick={selectAllPool}
                  >
                    {t('crew.roster.selectAll')}
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-1 text-[0.6rem] rounded border border-gray-300 bg-white text-gray-800 disabled:opacity-40"
                    disabled={workingMembers.length === 0 || saving}
                    onClick={clearAllPool}
                    title={t('crew.roster.clearAll')}
                  >
                    {t('crew.roster.clearAll')}
                  </button>
                </div>
              ) : null}
              <ul className="max-h-[min(50vh,22rem)] overflow-y-auto overscroll-y-contain divide-y divide-gray-100">
                {poolMembers.length === 0 ? (
                  <li className="px-2 py-3 text-center text-[0.65rem] text-gray-400">—</li>
                ) : (
                  poolMembers.map((mem) => {
                    const off = dayOffIds.has(mem.teamMemberId);
                    return (
                      <li key={mem.teamMemberId}>
                        {canEdit && !off ? (
                          <button
                            type="button"
                            onClick={() => moveOneToWorking(mem.teamMemberId)}
                            className={`w-full text-left px-2 py-2 text-sm border-l-2 border-transparent transition-colors ${listBtn}`}
                          >
                            <CrewMemberNameLines
                              className="text-sm"
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                            />
                          </button>
                        ) : (
                          <div
                            className={`px-2 py-2 text-sm flex items-center gap-1 min-w-0 ${
                              off ? 'bg-gray-100 text-gray-400' : 'text-gray-600'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <CrewMemberNameLines
                                className="text-sm"
                                name={mem.name}
                                nameTh={mem.nameTh}
                                inactive={!mem.isActive || off}
                              />
                            </div>
                            {off ? (
                              <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[0.6rem] font-medium text-gray-500">
                                {t('crew.roster.dayOffBadge')}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div className="flex-1 min-w-0 flex flex-col border border-emerald-200/80 rounded-md overflow-hidden bg-emerald-50/30">
              <div className="px-1.5 py-1 bg-emerald-100/90 border-b border-emerald-200 text-center">
                <CrewBiInline id="crew.roster.columnWorking" className="text-[0.65rem] font-medium text-emerald-950" />
              </div>
              {canEdit ? (
                <div className="flex gap-1 px-1 py-1 border-b border-emerald-200 bg-white">
                  <button
                    type="button"
                    className="flex-1 py-1 text-[0.6rem] rounded border border-gray-300 bg-white text-gray-800 disabled:opacity-40"
                    disabled={saving}
                    onClick={selectAllWorking}
                  >
                    {t('crew.roster.selectAll')}
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-1 text-[0.6rem] rounded border border-gray-300 bg-white text-gray-800 disabled:opacity-40"
                    disabled={workingMembers.length === 0 || saving}
                    onClick={clearAllWorking}
                  >
                    {t('crew.roster.clearAll')}
                  </button>
                </div>
              ) : null}
              <ul className="max-h-[min(50vh,22rem)] overflow-y-auto overscroll-y-contain divide-y divide-emerald-100">
                {workingMembers.length === 0 ? (
                  <li className="px-2 py-3 text-center text-[0.65rem] text-gray-400">—</li>
                ) : (
                  workingMembers.map((mem) => {
                    const onStandby = standbyIds.has(mem.teamMemberId);
                    const standbyLabel = t('crew.roster.standbyButton');
                    return (
                      <li key={mem.teamMemberId}>
                        {canEdit ? (
                          <div className="flex items-stretch gap-0.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => moveOneToPool(mem.teamMemberId)}
                              className={`flex-1 min-w-0 text-left px-2 py-2 text-sm border-l-2 border-transparent transition-colors ${listBtn}`}
                            >
                              <CrewMemberNameLines
                                className="text-sm"
                                name={mem.name}
                                nameTh={mem.nameTh}
                                inactive={!mem.isActive}
                                variant="emerald"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStandby(mem.teamMemberId);
                              }}
                              title={standbyLabel}
                              aria-pressed={onStandby}
                              className={`shrink-0 self-center mx-0.5 px-1.5 py-1 rounded border text-[0.6rem] font-semibold leading-none min-w-[2rem] ${standbyBtn(onStandby)}`}
                            >
                              {standbyLabel}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 py-2 text-sm text-emerald-900 min-w-0">
                            <div className="flex-1 min-w-0">
                              <CrewMemberNameLines
                                className="text-sm"
                                name={mem.name}
                                nameTh={mem.nameTh}
                                inactive={!mem.isActive}
                                variant="emerald"
                              />
                            </div>
                            {onStandby ? (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[0.6rem] font-medium">
                                {standbyLabel}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        )}

        {canEdit && !loading ? (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/80 px-2 py-2 space-y-2">
            <label className="flex items-center gap-2 text-[0.7rem] text-gray-800">
              <input
                type="checkbox"
                checked={applyMode !== 'none'}
                onChange={(e) => {
                  if (e.target.checked) setApplyMode('restWeek');
                  else {
                    setApplyMode('none');
                    setPickedDates(new Set());
                  }
                }}
              />
              {t('crew.roster.applyOtherDays')}
            </label>
            {applyMode !== 'none' ? (
              <div className="flex flex-col gap-1.5 pl-1">
                <label className="flex items-center gap-2 text-[0.65rem] text-gray-700">
                  <input
                    type="radio"
                    name="crew-roster-apply"
                    checked={applyMode === 'restWeek'}
                    onChange={() => setApplyMode('restWeek')}
                  />
                  {t('crew.roster.applyRestOfWeek')}
                  {applyMode === 'restWeek' && targetApplyDates.length > 0 ? (
                    <span className="text-gray-500 tabular-nums">({targetApplyDates.length})</span>
                  ) : null}
                </label>
                <label className="flex items-center gap-2 text-[0.65rem] text-gray-700">
                  <input
                    type="radio"
                    name="crew-roster-apply"
                    checked={applyMode === 'pick'}
                    onChange={() => setApplyMode('pick')}
                  />
                  {t('crew.roster.applyPickDays')}
                </label>
                {applyMode === 'pick' ? (
                  <div className="mt-1">
                    <p className="text-[0.6rem] text-gray-500 mb-1">{t('crew.roster.applyPickHint')}</p>
                    <div className="grid grid-cols-7 gap-0.5">
                      {pickMonthDays.map((key) => {
                        const picked = pickedDates.has(key);
                        const dayNum = Number(key.slice(8));
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setPickedDates((prev) => {
                                const next = new Set(prev);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              });
                            }}
                            className={`h-7 rounded text-[0.6rem] tabular-nums border ${
                              picked
                                ? 'border-gray-900 bg-gray-900 text-white'
                                : 'border-gray-200 bg-white text-gray-700'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {canEdit ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => requestSave()}
              className="w-full px-2 py-1.5 text-xs leading-tight bg-gray-900 text-white rounded-md disabled:opacity-50"
            >
              {saving ? (
                <span className="block text-[0.65rem]">{t('crew.roster.saving')}</span>
              ) : (
                <span className="block font-medium">{t('crew.roster.saveDay')}</span>
              )}
            </button>
          </div>
        ) : null}
      </div>

      {passwordModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crew-roster-pw-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePasswordModal();
          }}
        >
          <div
            className="w-full max-w-md rounded-t-xl sm:rounded-xl bg-white shadow-lg border border-gray-200 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="crew-roster-pw-modal-title" className="text-sm font-semibold text-gray-900">
              <CrewBiLine id="crew.roster.modalPasswordTitle" koClassName="font-semibold" />
            </h3>
            <p className="text-[0.7rem] text-gray-600 mt-2 leading-snug">
              <CrewBiLine id="crew.roster.modalPasswordHint" />
            </p>
            <label className="block text-[0.65rem] text-gray-700 mt-3 mb-1">
              <CrewBiLine id="crew.roster.sensitivePasswordLabel" />
            </label>
            <input
              type="password"
              autoComplete="off"
              value={modalPassword}
              onChange={(e) => setModalPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closePasswordModal();
                if (e.key === 'Enter') confirmPasswordModal();
              }}
              placeholder={t('crew.roster.sensitivePasswordPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              autoFocus
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closePasswordModal}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800"
              >
                {t('crew.roster.modalCancel')}
              </button>
              <button
                type="button"
                onClick={() => confirmPasswordModal()}
                className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white"
              >
                {t('crew.roster.modalConfirmSave')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
