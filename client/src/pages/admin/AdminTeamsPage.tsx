import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import {
  getPoolTeamMembers,
  addPoolTeamMember,
  updatePoolTeamMember,
  deletePoolTeamMember,
  getPoolMemberDayOffs,
  addPoolMemberDayOff,
  removePoolMemberDayOff,
  type TeamMemberItem,
} from '../../api/teams';

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function AdminTeamsPage() {
  const token = getToken();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'other'>('loading');
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [memberForm, setMemberForm] = useState({ name: '', phone: '' });
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerOk, setRegisterOk] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ memberId: string; label: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [dayOffModal, setDayOffModal] = useState<{ memberId: string; memberName: string } | null>(null);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  const [dayOffLoading, setDayOffLoading] = useState(false);

  const [editMemberModal, setEditMemberModal] = useState<{
    memberId: string;
    name: string;
    phone: string;
  } | null>(null);
  const [editMemberSaving, setEditMemberSaving] = useState(false);

  const memberRowBtn =
    'px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-800 hover:bg-gray-50 whitespace-nowrap';
  const memberRowBtnPrimary =
    'px-2.5 py-1.5 text-xs border border-blue-200 rounded bg-white text-blue-800 hover:bg-blue-50 whitespace-nowrap';
  const memberRowBtnDanger =
    'px-2.5 py-1.5 text-xs border border-red-100 rounded bg-white text-red-700 hover:bg-red-50 whitespace-nowrap';

  const refresh = async () => {
    if (!token) return;
    setApiError(null);
    try {
      const pool = await getPoolTeamMembers(token);
      setMembers(pool.items);
    } catch (e) {
      /* 목록을 비우지 않음: 직전 등록 성공 후 새로고침만 실패해도 데이터가 사라지지 않게 */
      setApiError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setRoleGate('other');
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setRoleGate(u.role === 'ADMIN' ? 'admin' : 'other'))
      .catch(() => setRoleGate('other'));
  }, [token]);

  useEffect(() => {
    if (!token || roleGate !== 'admin') return;
    refresh();
  }, [token, roleGate]);

  useEffect(() => {
    if (!token || !dayOffModal) return;
    const { start, end } = getMonthRange(calYear, calMonth);
    setDayOffLoading(true);
    getPoolMemberDayOffs(token, dayOffModal.memberId, start, end)
      .then((r) => setDayOffDates(new Set(r.items)))
      .catch(() => setDayOffDates(new Set()))
      .finally(() => setDayOffLoading(false));
  }, [token, dayOffModal, calYear, calMonth]);

  if (!token) return <Navigate to="/admin/login" replace />;
  if (roleGate === 'loading') {
    return <div className="text-sm text-gray-500 py-8">권한 확인 중…</div>;
  }
  if (roleGate !== 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const submitPasswordDelete = async () => {
    if (!token || !deleteTarget) return;
    setPasswordBusy(true);
    try {
      await deletePoolTeamMember(token, deleteTarget.memberId, passwordInput);
      setDeleteTarget(null);
      setPasswordInput('');
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const toggleMemberDayOff = async (d: number) => {
    if (!token || !dayOffModal) return;
    const m = calMonth < 10 ? `0${calMonth}` : `${calMonth}`;
    const day = d < 10 ? `0${d}` : `${d}`;
    const key = `${calYear}-${m}-${day}`;
    const isOff = dayOffDates.has(key);
    try {
      if (isOff) {
        await removePoolMemberDayOff(token, dayOffModal.memberId, key);
        setDayOffDates((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        });
      } else {
        await addPoolMemberDayOff(token, dayOffModal.memberId, key);
        setDayOffDates((prev) => new Set(prev).add(key));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '처리 실패');
    }
  };

  const submitEditMember = async () => {
    if (!token || !editMemberModal) return;
    const name = editMemberModal.name.trim();
    if (!name) {
      alert('이름을 입력해주세요.');
      return;
    }
    setEditMemberSaving(true);
    try {
      const phone = editMemberModal.phone.trim() || null;
      await updatePoolTeamMember(token, editMemberModal.memberId, { name, phone });
      setEditMemberModal(null);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setEditMemberSaving(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="flex flex-col gap-6 min-w-0 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">팀원 관리</h1>
        <p className="text-sm text-gray-600 mt-1">
          현장 투입 인원을 등록합니다. 예약일마다 접수 가능한 투입 수는{' '}
          <span className="text-gray-800">활성 팀원 수 − 그날 휴무</span>로 맞춥니다. 목록에서 휴무일·이름·연락처·사용
          여부·삭제를 관리할 수 있습니다.
        </p>
      </div>

      {apiError && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">{apiError}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-8">불러오는 중…</div>
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">팀원 목록</h2>
          <p className="text-xs text-gray-500 mb-3">
            등록한 팀원이 아래에 표시됩니다. 각 행에서 휴무일·정보 수정·사용 중지·삭제를 할 수 있습니다.
          </p>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-md px-3 py-4 text-center mb-3">
              아직 등록된 팀원이 없습니다. 아래에서 이름을 입력하고 등록하세요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md mb-3">
              {members.map((m) => (
                <li key={m.id} className="px-3 py-3 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={m.isActive ? 'font-medium text-gray-900' : 'text-gray-400 line-through'}>
                          {m.name}
                        </span>
                        {m.phone ? (
                          <span className="text-gray-500 text-xs">{m.phone}</span>
                        ) : (
                          <span className="text-xs text-gray-400">연락처 없음</span>
                        )}
                        {!m.isActive && (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                            사용 안 함
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDayOffModal({ memberId: m.id, memberName: m.name })}
                        className={memberRowBtnPrimary}
                      >
                        휴무일
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditMemberModal({
                            memberId: m.id,
                            name: m.name,
                            phone: m.phone ?? '',
                          })
                        }
                        className={memberRowBtn}
                      >
                        정보 수정
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await updatePoolTeamMember(token!, m.id, { isActive: !m.isActive });
                            await refresh();
                          } catch (e) {
                            alert(e instanceof Error ? e.message : '변경 실패');
                          }
                        }}
                        className={memberRowBtn}
                      >
                        {m.isActive ? '사용 중지' : '다시 사용'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            memberId: m.id,
                            label: m.name,
                          })
                        }
                        className={memberRowBtnDanger}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {members.filter((m) => m.isActive).length < 100 && (
            <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 items-end">
              <input
                type="text"
                placeholder="이름"
                value={memberForm.name}
                onChange={(e) => {
                  setRegisterOk(null);
                  setMemberForm((p) => ({ ...p, name: e.target.value }));
                }}
                className="px-3 py-2 border border-gray-300 rounded text-sm w-36"
              />
              <input
                type="text"
                placeholder="연락처 (선택)"
                value={memberForm.phone}
                onChange={(e) => {
                  setRegisterOk(null);
                  setMemberForm((p) => ({ ...p, phone: e.target.value }));
                }}
                className="px-3 py-2 border border-gray-300 rounded text-sm w-40"
              />
              <button
                type="button"
                disabled={registerBusy}
                onClick={async () => {
                  if (!token || !memberForm.name.trim()) {
                    alert('이름을 입력해주세요.');
                    return;
                  }
                  setRegisterOk(null);
                  setRegisterBusy(true);
                  try {
                    await addPoolTeamMember(token, {
                      name: memberForm.name.trim(),
                      phone: memberForm.phone.trim() || undefined,
                    });
                    setMemberForm({ name: '', phone: '' });
                    setRegisterOk('등록되었습니다. 목록을 갱신합니다.');
                    await refresh();
                    setRegisterOk('등록되었습니다.');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '등록 실패');
                  } finally {
                    setRegisterBusy(false);
                  }
                }}
                className="px-3 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900 disabled:opacity-50"
              >
                {registerBusy ? '등록 중…' : '팀원 등록'}
              </button>
            </div>
            {registerOk && <p className="text-sm text-green-700">{registerOk}</p>}
            </div>
          )}
          {members.filter((m) => m.isActive).length >= 100 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              활성 팀원이 상한(100명)에 도달했습니다. 사용 중지 후 추가하거나 관리자에게 문의하세요.
            </p>
          )}
        </section>
      )}

      {editMemberModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="edit-member-title"
          >
            <div className="relative w-full max-w-sm rounded-lg bg-white shadow-lg border border-gray-200 p-5">
              <ModalCloseButton
                onClick={() => setEditMemberModal(null)}
                disabled={editMemberSaving}
              />
              <h2 id="edit-member-title" className="text-base font-semibold text-gray-900 pr-10">
                팀원 정보 수정
              </h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">이름</label>
                  <input
                    type="text"
                    value={editMemberModal.name}
                    onChange={(e) =>
                      setEditMemberModal((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">연락처 (선택)</label>
                  <input
                    type="text"
                    value={editMemberModal.phone}
                    onChange={(e) =>
                      setEditMemberModal((prev) => (prev ? { ...prev, phone: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => setEditMemberModal(null)}
                  disabled={editMemberSaving}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-40"
                  disabled={editMemberSaving}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void submitEditMember();
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {deleteTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="pw-del-title"
          >
            <div className="relative w-full max-w-sm rounded-lg bg-white shadow-lg border border-gray-200 p-5">
              <ModalCloseButton
                onClick={() => {
                  setDeleteTarget(null);
                  setPasswordInput('');
                }}
                disabled={passwordBusy}
              />
              <h2 id="pw-del-title" className="text-base font-semibold text-gray-900 pr-10">
                삭제 확인
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                <strong className="font-medium text-gray-800">{deleteTarget.label}</strong> 팀원을 삭제합니다. 관리자
                비밀번호를 입력하세요.
              </p>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="비밀번호"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => {
                    setDeleteTarget(null);
                    setPasswordInput('');
                  }}
                  disabled={passwordBusy}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40"
                  disabled={passwordBusy || !passwordInput.trim()}
                  onClick={() => submitPasswordDelete()}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {dayOffModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="dayoff-title"
          >
            <div className="relative w-full max-w-md rounded-lg bg-white shadow-lg border border-gray-200 p-5 max-h-[90vh] overflow-y-auto">
              <ModalCloseButton onClick={() => setDayOffModal(null)} />
              <h2 id="dayoff-title" className="text-base font-semibold text-gray-900 pr-10">
                휴무일 등록·변경 — {dayOffModal.memberName}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                날짜를 눌러 휴무일을 넣거나 뺍니다. 노란색이 휴무일입니다.
              </p>

              <div className="flex gap-2 items-center mt-4">
                <select
                  value={calYear}
                  onChange={(e) => setCalYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
                <select
                  value={calMonth}
                  onChange={(e) => setCalMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
              </div>

              {dayOffLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">로딩 중…</div>
              ) : (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-7 text-center text-xs">
                    {WEEKDAYS.map((w, wi) => (
                      <div
                        key={w}
                        className={`py-2 font-medium ${wi === 0 ? 'text-red-500' : wi === 6 ? 'text-blue-600' : 'text-gray-600'}`}
                      >
                        {w}
                      </div>
                    ))}
                    {getCalendarDays(calYear, calMonth).map((d, i) => (
                      <div key={i} className="border-t border-gray-100 min-h-[2.25rem] flex items-center justify-center p-0.5">
                        {d != null ? (
                          <button
                            type="button"
                            onClick={() => toggleMemberDayOff(d)}
                            className={`w-full h-full min-h-[2rem] text-sm rounded ${
                              dayOffDates.has(
                                `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                              )
                                ? 'bg-amber-100 text-amber-900 font-medium'
                                : 'hover:bg-gray-100 text-gray-800'
                            }`}
                          >
                            {d}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
