import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { getCrewDayRoster, putCrewDayRoster, type CrewMeResponse } from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { CrewBiLine, CrewBiInline, crewT } from '../../i18n/crew/crewI18n';
import { CrewMemberNameLines } from '../../components/crew/CrewMemberNameLines';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function CrewRosterDayPage() {
  const { ymd } = useParams<{ ymd: string }>();
  const navigate = useNavigate();
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const reloadMe = outlet?.reloadMe;

  const [workingIds, setWorkingIds] = useState<Set<string>>(new Set());
  const [highlightPool, setHighlightPool] = useState<Set<string>>(new Set());
  const [highlightWorking, setHighlightWorking] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const canEdit = me?.crewViewerRole === 'LEADER';
  const needsSensitivePassword =
    Boolean(canEdit && me?.group.useDailyRosterOnly && me?.group.hasSettingsPassword);
  const members: CrewMeResponse['group']['members'] = me?.group.members ?? [];

  const loadDay = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me || !ymd || !YMD_RE.test(ymd)) return;
    setLoading(true);
    try {
      const r = await getCrewDayRoster(token, ymd, ymd);
      const items = Array.isArray(r.items) ? r.items : [];
      const row = items.find((it) => it && it.date === ymd);
      const ids = row && Array.isArray(row.teamMemberIds) ? row.teamMemberIds : [];
      setWorkingIds(new Set(ids));
      setHighlightPool(new Set());
      setHighlightWorking(new Set());
    } catch {
      setWorkingIds(new Set());
      setHighlightPool(new Set());
      setHighlightWorking(new Set());
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

  const goCalendar = () => {
    navigate('/crew/roster');
  };

  const togglePoolHighlight = (id: string) => {
    if (!canEdit) return;
    setHighlightPool((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleWorkingHighlight = (id: string) => {
    if (!canEdit) return;
    setHighlightWorking((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveToWorking = () => {
    if (!canEdit || highlightPool.size === 0) return;
    setWorkingIds((prev) => {
      const next = new Set(prev);
      for (const id of highlightPool) next.add(id);
      return next;
    });
    setHighlightPool(new Set());
  };

  const moveToPool = () => {
    if (!canEdit || highlightWorking.size === 0) return;
    setWorkingIds((prev) => {
      const next = new Set(prev);
      for (const id of highlightWorking) next.delete(id);
      return next;
    });
    setHighlightWorking(new Set());
  };

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
      const skip = crewT('crew.roster.alertSaveSkipped');
      alert(`${skip.ko}\n${skip.th}`);
      return;
    }
    setSaving(true);
    const ok = crewT('crew.roster.alertSaved');
    const fail = crewT('crew.roster.alertSaveFail');
    try {
      await putCrewDayRoster(
        token,
        [{ date: ymd, teamMemberIds: [...workingIds] }],
        {
          settingsPassword: needsSensitivePassword ? settingsPassword : undefined,
        },
      );
      await reloadMe?.();
      alert(`[${ok.ko}] ${ok.th}`);
      goCalendar();
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        alert(`[${fail.ko}]\n세션이 만료되었습니다. 다시 로그인해 주세요.\n${fail.th}`);
        return;
      }
      const detail = e instanceof Error && e.message.trim() ? e.message.trim() : fail.ko;
      alert(`[${fail.ko}]\n${detail}\n${fail.th}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmPasswordModal = () => {
    const p = modalPassword.trim();
    if (!p) {
      const req = crewT('crew.roster.modalPasswordRequired');
      alert(`${req.ko}\n${req.th}`);
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

  const listBtn = (on: boolean) =>
    on
      ? 'bg-indigo-100 border-indigo-400 text-indigo-950 ring-1 ring-indigo-300'
      : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50';

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
            <span className="block text-[0.6rem]">
              {crewT('crew.roster.backToCalendar').ko}/{crewT('crew.roster.backToCalendar').th}
            </span>
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
            {crewT('crew.roster.close').ko}/{crewT('crew.roster.close').th}
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
            aria-label={`${crewT('crew.roster.helpToggleAria').ko} / ${crewT('crew.roster.helpToggleAria').th}`}
            onClick={() => setHelpOpen((v) => !v)}
            className="shrink-0 mt-0.5 w-6 h-6 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>
        </div>
        {helpOpen ? (
          <div className="mt-1.5 p-2 rounded-md border border-gray-200 bg-gray-50 text-[0.65rem] text-gray-600 leading-snug">
            {canEdit ? <CrewBiLine id="crew.roster.dayEditorHintLeader" /> : <CrewBiLine id="crew.roster.hintView" />}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-500 mt-3">
            <CrewBiLine id="crew.common.loading" />
          </p>
        ) : (
          <div className="mt-3 flex gap-1 sm:gap-2 min-h-0 min-w-0 items-stretch">
            {/* 왼쪽: 멤버 풀 */}
            <div className="flex-1 min-w-0 flex flex-col border border-gray-200 rounded-md overflow-hidden bg-gray-50/50">
              <div className="px-1.5 py-1 bg-gray-100 border-b border-gray-200 text-center">
                <CrewBiInline id="crew.roster.columnMembers" className="text-[0.65rem] font-medium text-gray-800" />
              </div>
              <ul className="max-h-[min(50vh,22rem)] overflow-y-auto overscroll-y-contain divide-y divide-gray-100">
                {poolMembers.length === 0 ? (
                  <li className="px-2 py-3 text-center text-[0.65rem] text-gray-400">—</li>
                ) : (
                  poolMembers.map((mem) => {
                    const hi = highlightPool.has(mem.teamMemberId);
                    return (
                      <li key={mem.teamMemberId}>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => togglePoolHighlight(mem.teamMemberId)}
                            className={`w-full text-left px-2 py-2 text-sm border-l-2 transition-colors ${listBtn(hi)}`}
                          >
                            <CrewMemberNameLines
                              className="text-sm"
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                            />
                          </button>
                        ) : (
                          <div className="px-2 py-2 text-sm text-gray-600">
                            <CrewMemberNameLines
                              className="text-sm"
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {/* 가운데: 화살표 */}
            <div className="shrink-0 flex flex-col justify-center gap-2 py-1">
              <button
                type="button"
                disabled={!canEdit || saving || highlightPool.size === 0}
                onClick={moveToWorking}
                title={`${crewT('crew.roster.transferToWorking').ko} / ${crewT('crew.roster.transferToWorking').th}`}
                className="min-h-[2.75rem] min-w-[2.5rem] rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-800 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:bg-gray-100"
                aria-label={`${crewT('crew.roster.transferToWorking').ko}`}
              >
                →
              </button>
              <button
                type="button"
                disabled={!canEdit || saving || highlightWorking.size === 0}
                onClick={moveToPool}
                title={`${crewT('crew.roster.transferToPool').ko} / ${crewT('crew.roster.transferToPool').th}`}
                className="min-h-[2.75rem] min-w-[2.5rem] rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-800 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:bg-gray-100"
                aria-label={`${crewT('crew.roster.transferToPool').ko}`}
              >
                ←
              </button>
            </div>

            {/* 오른쪽: 일할 멤버 */}
            <div className="flex-1 min-w-0 flex flex-col border border-emerald-200/80 rounded-md overflow-hidden bg-emerald-50/30">
              <div className="px-1.5 py-1 bg-emerald-100/90 border-b border-emerald-200 text-center">
                <CrewBiInline id="crew.roster.columnWorking" className="text-[0.65rem] font-medium text-emerald-950" />
              </div>
              <ul className="max-h-[min(50vh,22rem)] overflow-y-auto overscroll-y-contain divide-y divide-emerald-100">
                {workingMembers.length === 0 ? (
                  <li className="px-2 py-3 text-center text-[0.65rem] text-gray-400">—</li>
                ) : (
                  workingMembers.map((mem) => {
                    const hi = highlightWorking.has(mem.teamMemberId);
                    return (
                      <li key={mem.teamMemberId}>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => toggleWorkingHighlight(mem.teamMemberId)}
                            className={`w-full text-left px-2 py-2 text-sm border-l-2 transition-colors ${listBtn(hi)}`}
                          >
                            <CrewMemberNameLines
                              className="text-sm"
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                              variant="emerald"
                            />
                          </button>
                        ) : (
                          <div className="px-2 py-2 text-sm text-emerald-900">
                            <CrewMemberNameLines
                              className="text-sm"
                              name={mem.name}
                              nameTh={mem.nameTh}
                              inactive={!mem.isActive}
                              variant="emerald"
                            />
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

        {canEdit ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => requestSave()}
              className="w-full px-2 py-1.5 text-xs leading-tight bg-gray-900 text-white rounded-md disabled:opacity-50"
            >
              {saving ? (
                <span className="block text-[0.65rem]">
                  {crewT('crew.roster.saving').ko} · {crewT('crew.roster.saving').th}
                </span>
              ) : (
                <span className="block font-medium">
                  {crewT('crew.roster.saveDay').ko}
                  <span className="text-gray-300 mx-0.5">·</span>
                  <span className="text-gray-200 font-normal">{crewT('crew.roster.saveDay').th}</span>
                </span>
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
              placeholder={`${crewT('crew.roster.sensitivePasswordPlaceholder').ko} / ${crewT('crew.roster.sensitivePasswordPlaceholder').th}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              autoFocus
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closePasswordModal}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-800"
              >
                {crewT('crew.roster.modalCancel').ko}/{crewT('crew.roster.modalCancel').th}
              </button>
              <button
                type="button"
                onClick={() => confirmPasswordModal()}
                className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white"
              >
                {crewT('crew.roster.modalConfirmSave').ko}/{crewT('crew.roster.modalConfirmSave').th}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
