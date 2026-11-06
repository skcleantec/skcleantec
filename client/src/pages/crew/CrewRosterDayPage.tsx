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
import { kstTodayYmd } from '../../utils/dateFormat';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { useCrewUiLang } from '../../i18n/crew/crewUiLanguageContext';
import { CrewMemberNameLines } from '../../components/crew/CrewMemberNameLines';
import { confirmDialog, toast } from '../../components/ui/Toast';
import { CREW_CARD, CREW_SHELL } from './crewUi';

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THAI_WEEKDAY_SHORT = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const KO_WEEKDAY_SHORT = ['일','월','화','수','목','금','토'];

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

function formatDayHeader(ymd: string, lang: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  if (lang === 'th') {
    return `${THAI_WEEKDAY_SHORT[dow]} ${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
  }
  return `${y}/${pad2(m)}/${pad2(d)} (${KO_WEEKDAY_SHORT[dow]})`;
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
  const lang = useCrewUiLang();

  const [workingIds, setWorkingIds] = useState<Set<string>>(new Set());
  const [standbyIds, setStandbyIds] = useState<Set<string>>(new Set());
  const [dayOffIds, setDayOffIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState('');
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
    setWorkingIds((prev) => { const n = new Set(prev); n.add(id); return n; });
  };

  const moveOneToPool = (id: string) => {
    if (!canEdit) return;
    setWorkingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setStandbyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const selectAllPool = () => {
    if (!canEdit || selectablePoolIds.length === 0) return;
    setWorkingIds((prev) => { const n = new Set(prev); for (const id of selectablePoolIds) n.add(id); return n; });
  };

  const clearAllWorking = () => {
    if (!canEdit) return;
    setWorkingIds(new Set());
    setStandbyIds(new Set());
  };

  const toggleStandby = (id: string) => {
    if (!canEdit) return;
    setStandbyIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
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
      const nextStandby = new Set([...parsed.standby].filter((id) => next.has(id) && !dayOffIds.has(id)));
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
      <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <CrewBiLine id="crew.common.outletMissing" />
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-[13px] text-slate-500 py-6 text-center">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  if (!ymd || !YMD_RE.test(ymd)) {
    return <Navigate to="/crew/roster" replace />;
  }

  const isToday = ymd === kstTodayYmd();
  const dayHeaderText = formatDayHeader(ymd, lang);

  return (
    <div className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* ─── Header ─── */}
      <div className={`${CREW_CARD} px-3 py-2.5 mb-3`}>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/crew/roster/${addDaysYmd(ymd, -1)}`)}
            className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[15px] font-medium text-slate-700"
            aria-label={t('crew.roster.prevDayAria')}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goCalendar}
            className="min-w-0 flex-1 text-center rounded-xl px-1 py-1"
          >
            <div className="text-[14px] font-semibold text-[#0F172A] truncate tabular-nums">{dayHeaderText}</div>
            {isToday ? (
              <div className="text-[12px] text-[#1D4ED8] font-medium mt-0.5">
                <CrewBiLine id="crew.roster.todayBadge" />
              </div>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/crew/roster/${addDaysYmd(ymd, 1)}`)}
            className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[15px] font-medium text-slate-700"
            aria-label={t('crew.roster.nextDayAria')}
          >
            ›
          </button>
        </div>

        {canEdit && !loading ? (
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              className="flex-1 min-h-11 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-700 disabled:opacity-40"
              disabled={saving}
              onClick={() => void fillFromDate(addDaysYmd(ymd, -1))}
            >
              <CrewBiLine id="crew.roster.copyYesterday" />
            </button>
            <button
              type="button"
              className="flex-1 min-h-11 rounded-xl border border-slate-200 bg-white text-[12px] font-medium text-slate-700 disabled:opacity-40"
              disabled={saving}
              onClick={() => void fillFromDate(addDaysYmd(ymd, -7))}
            >
              <CrewBiLine id="crew.roster.copySameWeekday" />
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[13px] text-slate-500 py-6 text-center">
          <CrewBiLine id="crew.common.loading" />
        </p>
      ) : (
        <>
          {/* ─── Working (TOP) ─── */}
          <div className={`${CREW_CARD} mb-3 overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#15803D]/10 border-b border-[#15803D]/20">
              <span className="text-[13px] font-semibold text-[#15803D]">
                {t('crew.roster.workingHeader', { n: String(workingMembers.length) })}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  className="text-[12px] text-slate-600 min-h-9 px-2 rounded-lg border border-slate-200 bg-white"
                  disabled={workingMembers.length === 0 || saving}
                  onClick={clearAllWorking}
                >
                  <CrewBiLine id="crew.roster.clearAll" />
                </button>
              ) : null}
            </div>
            {workingMembers.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-slate-400">—</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {workingMembers.map((mem) => {
                  const onStandby = standbyIds.has(mem.teamMemberId);
                  return (
                    <li key={mem.teamMemberId}>
                      <div className="flex items-center min-w-0">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => moveOneToPool(mem.teamMemberId)}
                            className="flex-1 min-w-0 min-h-11 text-left px-3 py-2"
                          >
                            <CrewMemberNameLines
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                              variant="emerald"
                            />
                          </button>
                        ) : (
                          <div className="flex-1 min-w-0 px-3 py-2">
                            <CrewMemberNameLines
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                              variant="emerald"
                            />
                          </div>
                        )}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleStandby(mem.teamMemberId); }}
                            aria-pressed={onStandby}
                            className={`shrink-0 mr-3 min-h-9 px-2.5 rounded-lg border text-[12px] font-semibold leading-none ${
                              onStandby
                                ? 'border-amber-500 bg-amber-500 text-white'
                                : 'border-slate-300 bg-white text-slate-600'
                            }`}
                          >
                            <CrewBiLine id="crew.roster.standbyButton" />
                          </button>
                        ) : onStandby ? (
                          <span className="shrink-0 mr-3 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[12px] font-medium">
                            <CrewBiLine id="crew.roster.standbyButton" />
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ─── Pool (BOTTOM) ─── */}
          <div className={`${CREW_CARD} mb-3 overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-[13px] font-semibold text-slate-700">
                {t('crew.roster.poolHeader', { n: String(poolMembers.length) })}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  className="text-[12px] text-slate-600 min-h-9 px-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                  disabled={selectablePoolIds.length === 0 || saving}
                  onClick={selectAllPool}
                >
                  <CrewBiLine id="crew.roster.selectAll" />
                </button>
              ) : null}
            </div>
            {poolMembers.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-slate-400">—</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {poolMembers.map((mem) => {
                  const off = dayOffIds.has(mem.teamMemberId);
                  if (!canEdit || off) {
                    return (
                      <li key={mem.teamMemberId}>
                        <div className={`flex items-center min-h-11 px-3 py-2 min-w-0 ${off ? 'bg-slate-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <CrewMemberNameLines
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive || off}
                            />
                          </div>
                          {off ? (
                            <span className="shrink-0 ml-2 rounded-lg bg-slate-200 px-2 py-0.5 text-[12px] font-medium text-slate-500">
                              <CrewBiLine id="crew.roster.dayOffBadge" />
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={mem.teamMemberId}>
                      <button
                        type="button"
                        onClick={() => moveOneToWorking(mem.teamMemberId)}
                        className="w-full text-left min-h-11 px-3 py-2"
                      >
                        <CrewMemberNameLines
                          name={mem.name}
                          nameTh={mem.nameTh}
                          inactive={!mem.isActive}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ─── Apply-other-days options (shown when checkbox checked) ─── */}
          {canEdit && applyMode !== 'none' ? (
            <div className={`${CREW_CARD} px-3 py-3 mb-3 space-y-2`}>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="radio"
                    name="crew-roster-apply"
                    checked={applyMode === 'restWeek'}
                    onChange={() => setApplyMode('restWeek')}
                  />
                  <CrewBiLine id="crew.roster.applyRestOfWeek" />
                  {applyMode === 'restWeek' && targetApplyDates.length > 0 ? (
                    <span className="text-slate-500 tabular-nums text-[12px]">({targetApplyDates.length})</span>
                  ) : null}
                </label>
                <label className="flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="radio"
                    name="crew-roster-apply"
                    checked={applyMode === 'pick'}
                    onChange={() => setApplyMode('pick')}
                  />
                  <CrewBiLine id="crew.roster.applyPickDays" />
                </label>
              </div>
              {applyMode === 'pick' ? (
                <div>
                  <p className="text-[12px] text-slate-500 mb-1.5">{t('crew.roster.applyPickHint')}</p>
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
                              if (next.has(key)) next.delete(key); else next.add(key);
                              return next;
                            });
                          }}
                          className={`h-9 rounded-xl text-[12px] tabular-nums border ${
                            picked
                              ? 'border-[#0F172A] bg-[#0F172A] text-white'
                              : 'border-slate-200 bg-white text-slate-700'
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
        </>
      )}

      {/* ─── Sticky footer above bottom tab ─── */}
      {canEdit ? (
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)]"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className={`${CREW_SHELL} flex items-center gap-3 px-3 py-2`}>
            <label className="flex items-center gap-2 text-[13px] text-slate-700 shrink-0">
              <input
                type="checkbox"
                checked={applyMode !== 'none'}
                onChange={(e) => {
                  if (e.target.checked) setApplyMode('restWeek');
                  else { setApplyMode('none'); setPickedDates(new Set()); }
                }}
                className="h-4 w-4"
              />
              <CrewBiLine id="crew.roster.applyOtherDays" />
            </label>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => requestSave()}
              className="flex-1 min-h-11 rounded-xl bg-[#0F172A] text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? t('crew.roster.saving')
                : t('crew.roster.saveDayCount', { n: String(workingMembers.length) })}
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── Password modal ─── */}
      {passwordModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crew-roster-pw-modal-title"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closePasswordModal(); }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-lg border border-slate-200 p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="crew-roster-pw-modal-title" className="text-[15px] font-semibold text-[#0F172A]">
              <CrewBiLine id="crew.roster.modalPasswordTitle" />
            </h3>
            <p className="text-[13px] text-slate-600 mt-2 leading-snug">
              <CrewBiLine id="crew.roster.modalPasswordHint" />
            </p>
            <label className="block text-[12px] text-slate-700 mt-3 mb-1">
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
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-[14px]"
              autoFocus
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closePasswordModal}
                className="px-4 py-2.5 text-[13px] border border-slate-200 rounded-xl bg-white text-slate-700 min-h-11"
              >
                {t('crew.roster.modalCancel')}
              </button>
              <button
                type="button"
                onClick={() => confirmPasswordModal()}
                className="px-4 py-2.5 text-[13px] rounded-xl bg-[#0F172A] text-white min-h-11 font-semibold"
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
