import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { getToken } from '../../stores/auth';
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
import {
  getTeamCrewGroups,
  createTeamCrewGroup,
  updateTeamCrewGroup,
  deleteTeamCrewGroup,
  addTeamCrewGroupMember,
  removeTeamCrewGroupMember,
  setTeamCrewGroupMemberLeader,
  type TeamCrewGroupItem,
} from '../../api/teamCrewGroups';

/** 서버 teamCrewGroups LOGIN_ID_RE 와 동일 */
const CREW_LOGIN_ID_RE = /^[a-zA-Z0-9@._-]{3,64}$/;

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

  const [crewGroups, setCrewGroups] = useState<TeamCrewGroupItem[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);
  const [crewErr, setCrewErr] = useState<string | null>(null);
  const [crewCreateOpen, setCrewCreateOpen] = useState(false);
  const [crewEdit, setCrewEdit] = useState<TeamCrewGroupItem | null>(null);
  const [crewDelete, setCrewDelete] = useState<{ id: string; label: string } | null>(null);
  const [crewDeletePw, setCrewDeletePw] = useState('');
  const [crewDeleteBusy, setCrewDeleteBusy] = useState(false);

  const [crewCreateForm, setCrewCreateForm] = useState({
    name: '',
    loginId: '',
    password: '',
    phone: '',
    useDailyRosterOnly: false,
    settingsPassword: '',
    adminPassword: '',
  });
  const [crewCreateBusy, setCrewCreateBusy] = useState(false);

  const [crewEditForm, setCrewEditForm] = useState({
    name: '',
    phone: '',
    loginId: '',
    useDailyRosterOnly: false,
    isActive: true,
    newPassword: '',
    newSettingsPassword: '',
    clearSettingsPassword: false,
    adminPassword: '',
  });
  const [crewEditBusy, setCrewEditBusy] = useState(false);
  const [crewAddMemberId, setCrewAddMemberId] = useState('');

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

  const refreshCrew = async (): Promise<TeamCrewGroupItem[] | null> => {
    if (!token) return null;
    setCrewErr(null);
    setCrewLoading(true);
    try {
      const r = await getTeamCrewGroups(token);
      setCrewGroups(r.items);
      return r.items;
    } catch (e) {
      setCrewErr(e instanceof Error ? e.message : '크루 그룹을 불러오지 못했습니다.');
      return null;
    } finally {
      setCrewLoading(false);
    }
  };

  const syncCrewEditFromList = (items: TeamCrewGroupItem[] | null, groupId: string) => {
    if (!items) return;
    const g = items.find((x) => x.id === groupId);
    if (g) setCrewEdit(g);
  };

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshCrew();
  }, [token]);

  useEffect(() => {
    if (!token || !dayOffModal) return;
    const { start, end } = getMonthRange(calYear, calMonth);
    setDayOffLoading(true);
    getPoolMemberDayOffs(token, dayOffModal.memberId, start, end)
      .then((r) => setDayOffDates(new Set(r.items)))
      .catch(() => setDayOffDates(new Set()))
      .finally(() => setDayOffLoading(false));
  }, [token, dayOffModal, calYear, calMonth]);

  if (!token) return <Navigate to="/login" replace />;

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

  const openCrewEdit = (g: TeamCrewGroupItem) => {
    setCrewEdit(g);
    setCrewEditForm({
      name: g.name,
      phone: g.phone ?? '',
      loginId: g.loginId,
      useDailyRosterOnly: g.useDailyRosterOnly,
      isActive: g.isActive,
      newPassword: '',
      newSettingsPassword: '',
      clearSettingsPassword: false,
      adminPassword: '',
    });
    setCrewAddMemberId('');
  };

  const submitCrewCreate = async () => {
    if (!token) return;
    const name = crewCreateForm.name.trim();
    const loginId = crewCreateForm.loginId.trim();
    const password = crewCreateForm.password;
    const adminPassword = crewCreateForm.adminPassword.trim();
    if (!name || !loginId || password.length < 4) {
      alert('그룹 이름·로그인 아이디·비밀번호(4자 이상)를 입력해주세요.');
      return;
    }
    if (!CREW_LOGIN_ID_RE.test(loginId)) {
      alert(
        '공유 로그인 ID는 3~64자이며 영문·숫자·@ . _ - 만 사용할 수 있습니다. (한글·공백 불가)'
      );
      return;
    }
    if (!adminPassword) {
      alert('관리자 본인 비밀번호를 입력해주세요. (로그인할 때 쓰는 관리자 계정 비밀번호)');
      return;
    }
    const settingsPassword = crewCreateForm.settingsPassword.trim();
    if (settingsPassword && settingsPassword.length < 4) {
      alert('설정용 비밀번호는 4자 이상이거나 비워 두세요.');
      return;
    }
    setCrewCreateBusy(true);
    try {
      await createTeamCrewGroup(token, {
        name,
        loginId,
        password,
        phone: crewCreateForm.phone.trim() || null,
        useDailyRosterOnly: crewCreateForm.useDailyRosterOnly,
        settingsPassword: settingsPassword || null,
        adminPassword,
      });
      setCrewCreateOpen(false);
      setCrewCreateForm({
        name: '',
        loginId: '',
        password: '',
        phone: '',
        useDailyRosterOnly: false,
        settingsPassword: '',
        adminPassword: '',
      });
      try {
        await refreshCrew();
      } catch {
        setCrewErr('그룹은 생성되었으나 목록 갱신에 실패했습니다. 새로고침 해 보세요.');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '생성 실패');
    } finally {
      setCrewCreateBusy(false);
    }
  };

  const crewMemberMutate = async (fn: () => Promise<void>) => {
    if (!token || !crewEdit) return;
    const gid = crewEdit.id;
    try {
      await fn();
      const items = await refreshCrew();
      syncCrewEditFromList(items, gid);
    } catch (e) {
      alert(e instanceof Error ? e.message : '처리 실패');
    }
  };

  const submitCrewEdit = async () => {
    if (!token || !crewEdit) return;
    const orig = crewEdit;
    const body: Parameters<typeof updateTeamCrewGroup>[2] = {};
    if (crewEditForm.name.trim() !== orig.name) body.name = crewEditForm.name.trim();
    if ((crewEditForm.phone.trim() || '') !== (orig.phone ?? '')) {
      body.phone = crewEditForm.phone.trim() || null;
    }
    if (crewEditForm.loginId.trim() !== orig.loginId) body.loginId = crewEditForm.loginId.trim();
    if (crewEditForm.useDailyRosterOnly !== orig.useDailyRosterOnly) {
      body.useDailyRosterOnly = crewEditForm.useDailyRosterOnly;
    }
    if (crewEditForm.isActive !== orig.isActive) body.isActive = crewEditForm.isActive;

    if (body.loginId !== undefined && !CREW_LOGIN_ID_RE.test(String(body.loginId).trim())) {
      alert(
        '공유 로그인 ID는 3~64자이며 영문·숫자·@ . _ - 만 사용할 수 있습니다. (한글·공백 불가)'
      );
      return;
    }

    const needAdminPw =
      body.loginId !== undefined ||
      crewEditForm.newPassword.trim().length > 0 ||
      crewEditForm.newSettingsPassword.trim().length > 0 ||
      crewEditForm.clearSettingsPassword;

    if (needAdminPw) {
      const ap = crewEditForm.adminPassword.trim();
      if (!ap) {
        alert('로그인 아이디·비밀번호·설정용 비번을 변경할 때는 관리자 본인 비밀번호가 필요합니다.');
        return;
      }
      body.adminPassword = ap;
      if (crewEditForm.newPassword.trim()) body.password = crewEditForm.newPassword.trim();
      if (crewEditForm.newSettingsPassword.trim()) {
        body.settingsPassword = crewEditForm.newSettingsPassword.trim();
      }
      if (crewEditForm.clearSettingsPassword) body.clearSettingsPassword = true;
    }

    const keys = Object.keys(body).filter((k) => k !== 'adminPassword');
    if (keys.length === 0) {
      alert(
        '저장할 변경이 없습니다. 이름·연락처·로그인 ID·체크박스를 바꾸거나, 아래에서 비밀번호·설정용 비번을 변경할 때는 관리자 비밀번호를 함께 입력하세요.'
      );
      return;
    }

    setCrewEditBusy(true);
    try {
      const updated = await updateTeamCrewGroup(token, orig.id, body);
      setCrewEdit(updated);
      setCrewEditForm({
        name: updated.name,
        phone: updated.phone ?? '',
        loginId: updated.loginId,
        useDailyRosterOnly: updated.useDailyRosterOnly,
        isActive: updated.isActive,
        newPassword: '',
        newSettingsPassword: '',
        clearSettingsPassword: false,
        adminPassword: '',
      });
      const items = await refreshCrew();
      syncCrewEditFromList(items, updated.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setCrewEditBusy(false);
    }
  };

  const submitCrewDelete = async () => {
    if (!token || !crewDelete) return;
    const p = crewDeletePw.trim();
    if (!p) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    setCrewDeleteBusy(true);
    try {
      await deleteTeamCrewGroup(token, crewDelete.id, p);
      setCrewDelete(null);
      setCrewDeletePw('');
      await refreshCrew();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setCrewDeleteBusy(false);
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

      <section className="bg-white border border-gray-200 rounded-lg p-4 min-w-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">팀 크루 그룹 (공유 로그인)</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              현장 인원이 같은 아이디로 로그인해 동일 정보를 보게 할 그룹입니다. 멤버는 아래 팀원 목록(전사 풀)에서만
              추가합니다. <strong className="text-gray-700">날짜별 일할 수 있는 인원</strong>은 크루 공유 로그인(
              <span className="font-mono">/crew</span>) 후 「일자 명단」에서 그룹장이 지정합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCrewCreateOpen(true)}
            className="shrink-0 px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            새 그룹
          </button>
        </div>
        {crewErr && (
          <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2 mb-3">{crewErr}</div>
        )}
        {crewLoading ? (
          <p className="text-sm text-gray-500 py-4">크루 그룹 불러오는 중…</p>
        ) : crewGroups.length === 0 ? (
          <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-md px-3 py-4 text-center">
            등록된 크루 그룹이 없습니다. 「새 그룹」으로 만드세요.
          </p>
        ) : (
          <>
            <div className="hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full table-fixed border-collapse text-fluid-2xs xl:text-fluid-xs border border-gray-100 rounded-md overflow-hidden">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border-b border-gray-200 px-2 py-2 text-center">그룹명</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">로그인 ID</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">연락처</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">집계 모드</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">멤버</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">그룹장</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">상태</th>
                    <th className="border-b border-gray-200 px-2 py-2 text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {crewGroups.map((g) => {
                    const leader = g.members.find((m) => m.isGroupLeader);
                    return (
                      <tr key={g.id} className="group hover:bg-gray-50">
                        <td className="border-b border-gray-100 px-2 py-2 text-center truncate" title={g.name}>
                          {g.name}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center truncate font-mono" title={g.loginId}>
                          {g.loginId}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center truncate" title={g.phone ?? ''}>
                          {g.phone ?? '—'}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center">
                          {g.useDailyRosterOnly ? (
                            <span className="text-indigo-800">일자 명단만</span>
                          ) : (
                            <span className="text-gray-600">활성 전원</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums">{g.members.length}</td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center truncate" title={leader?.name ?? ''}>
                          {leader ? leader.name : '—'}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center">
                          {g.isActive ? (
                            <span className="text-green-800">사용</span>
                          ) : (
                            <span className="text-gray-400">중지</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-2 py-2 text-center">
                          <button
                            type="button"
                            className={memberRowBtn}
                            onClick={() => openCrewEdit(g)}
                          >
                            편집
                          </button>
                          <button
                            type="button"
                            className={`${memberRowBtnDanger} ml-1`}
                            onClick={() => setCrewDelete({ id: g.id, label: g.name })}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="lg:hidden divide-y divide-gray-100 border border-gray-100 rounded-md">
              {crewGroups.map((g) => {
                const leader = g.members.find((m) => m.isGroupLeader);
                return (
                  <li key={g.id} className="px-3 py-3 text-sm">
                    <div className="font-medium text-gray-900">{g.name}</div>
                    <div className="text-fluid-xs text-gray-600 mt-1">
                      ID <span className="font-mono">{g.loginId}</span>
                      {g.phone ? ` · ${g.phone}` : ''}
                    </div>
                    <div className="text-fluid-xs mt-1">
                      {g.useDailyRosterOnly ? '집계: 일자 명단만' : '집계: 활성 전원'} · 멤버 {g.members.length}명
                      {leader ? ` · 그룹장 ${leader.name}` : ''} · {g.isActive ? '사용' : '중지'}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button type="button" className={memberRowBtn} onClick={() => openCrewEdit(g)}>
                        편집
                      </button>
                      <button
                        type="button"
                        className={memberRowBtnDanger}
                        onClick={() => setCrewDelete({ id: g.id, label: g.name })}
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

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

      {crewCreateOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="crew-create-title"
          >
            <div className="relative w-full max-w-md rounded-lg bg-white shadow-lg border border-gray-200 p-5 max-h-[90vh] overflow-y-auto">
              <ModalCloseButton
                onClick={() => !crewCreateBusy && setCrewCreateOpen(false)}
                disabled={crewCreateBusy}
              />
              <h2 id="crew-create-title" className="text-base font-semibold text-gray-900 pr-10">
                크루 그룹 만들기
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                생성 시 <strong className="text-gray-700">관리자 본인 비밀번호</strong>(지금 로그인한 계정)로 확인합니다.
                공유 로그인 ID는 영문·숫자·@ . _ - 만, 3~64자(한글·공백 불가).
              </p>
              <form
                id="crew-create-form"
                className="mt-4 space-y-3 text-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitCrewCreate();
                }}
              >
                <div>
                  <label className="text-xs text-gray-500 block mb-1">그룹 이름</label>
                  <input
                    type="text"
                    value={crewCreateForm.name}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공유 로그인 ID</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={crewCreateForm.loginId}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, loginId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-fluid-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공유 로그인 비밀번호 (4자 이상)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={crewCreateForm.password}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">그룹 연락처 (선택)</label>
                  <input
                    type="text"
                    value={crewCreateForm.phone}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crewCreateForm.useDailyRosterOnly}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, useDailyRosterOnly: e.target.checked }))}
                    className="mt-1"
                  />
                  <span className="text-xs text-gray-700">
                    집계·팀원 선택 시 <strong>그룹장이 날짜별로 지정한 명단만</strong> 쓰기 (나중 단계에서 스케줄과 연동)
                  </span>
                </label>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">그룹 설정용 비밀번호 (선택, 공유 로그인과 별개)</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={crewCreateForm.settingsPassword}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, settingsPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                  <p className="text-fluid-2xs text-gray-500 mt-1">
                    위 「집계·명단」을 켠 상태에서 설정하면, 그룹장이 크루 화면에서 <strong>일자 명단 저장</strong>할 때만 이
                    비밀번호를 추가로 입력합니다. 집계 모드가 꺼져 있으면 저장 시 요구하지 않습니다.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">관리자 본인 비밀번호 (확인)</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={crewCreateForm.adminPassword}
                    onChange={(e) => setCrewCreateForm((p) => ({ ...p, adminPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </form>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={crewCreateBusy}
                  onClick={() => setCrewCreateOpen(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="crew-create-form"
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-40"
                  disabled={crewCreateBusy}
                >
                  {crewCreateBusy ? '저장 중…' : '만들기'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {crewEdit &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="crew-edit-title"
          >
            <div className="relative w-full max-w-lg rounded-lg bg-white shadow-lg border border-gray-200 p-5 max-h-[92vh] overflow-y-auto min-w-0">
              <ModalCloseButton
                onClick={() => !crewEditBusy && setCrewEdit(null)}
                disabled={crewEditBusy}
              />
              <h2 id="crew-edit-title" className="text-base font-semibold text-gray-900 pr-10">
                크루 그룹 편집 — {crewEdit.name}
              </h2>

              <div className="mt-4 space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">그룹 이름</label>
                    <input
                      type="text"
                      value={crewEditForm.name}
                      onChange={(e) => setCrewEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">연락처</label>
                    <input
                      type="text"
                      value={crewEditForm.phone}
                      onChange={(e) => setCrewEditForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">로그인 ID</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={crewEditForm.loginId}
                    onChange={(e) => setCrewEditForm((p) => ({ ...p, loginId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-fluid-xs"
                  />
                  <p className="text-fluid-2xs text-amber-800 mt-1">ID를 바꾸면 관리자 비밀번호가 필요합니다.</p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crewEditForm.useDailyRosterOnly}
                    onChange={(e) => setCrewEditForm((p) => ({ ...p, useDailyRosterOnly: e.target.checked }))}
                    className="mt-1"
                  />
                  <span className="text-xs text-gray-700">집계·선택 시 일자별 명단만 사용</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crewEditForm.isActive}
                    onChange={(e) => setCrewEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="mt-1"
                  />
                  <span className="text-xs text-gray-700">그룹 사용</span>
                </label>

                <div className="border-t border-gray-100 pt-3 mt-2">
                  <p className="text-xs font-medium text-gray-700 mb-2">공유 로그인 비밀번호 변경</p>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="비우면 유지"
                    value={crewEditForm.newPassword}
                    onChange={(e) => setCrewEditForm((p) => ({ ...p, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    그룹 설정용 비밀번호
                    {crewEdit.hasSettingsPassword ? (
                      <span className="text-green-700 font-normal"> (현재 설정됨)</span>
                    ) : (
                      <span className="text-gray-500 font-normal"> (미설정)</span>
                    )}
                  </p>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="새로 설정 (4자 이상)"
                    disabled={crewEditForm.clearSettingsPassword}
                    value={crewEditForm.newSettingsPassword}
                    onChange={(e) => setCrewEditForm((p) => ({ ...p, newSettingsPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded disabled:bg-gray-50"
                  />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={crewEditForm.clearSettingsPassword}
                      onChange={(e) =>
                        setCrewEditForm((p) => ({
                          ...p,
                          clearSettingsPassword: e.target.checked,
                          newSettingsPassword: e.target.checked ? '' : p.newSettingsPassword,
                        }))
                      }
                    />
                    설정용 비밀번호 제거
                  </label>
                  <p className="text-fluid-2xs text-gray-500 mt-2">
                    「집계·일자 명단」이 켜져 있고 설정용 비밀번호가 있을 때만, 그룹장의 명단 <strong>저장</strong> 시
                    2차 확인으로 사용됩니다.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    관리자 본인 비밀번호 (로그인 ID·비번·설정용 비번 변경 시 필요)
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={crewEditForm.adminPassword}
                    onChange={(e) => setCrewEditForm((p) => ({ ...p, adminPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-800 mb-2">멤버 (전사 팀원 풀)</p>
                <div className="flex flex-wrap gap-2 items-end mb-3">
                  <select
                    value={crewAddMemberId}
                    onChange={(e) => setCrewAddMemberId(e.target.value)}
                    className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">추가할 팀원 선택…</option>
                    {members
                      .filter((m) => !crewEdit.members.some((cm) => cm.teamMemberId === m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {!m.isActive ? ' (사용 중지)' : ''}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                    onClick={() => {
                      if (!crewAddMemberId) {
                        alert('팀원을 선택하세요.');
                        return;
                      }
                      void crewMemberMutate(async () => {
                        if (!token) return;
                        await addTeamCrewGroupMember(token, crewEdit.id, crewAddMemberId);
                        setCrewAddMemberId('');
                      });
                    }}
                  >
                    추가
                  </button>
                </div>
                <ul className="border border-gray-100 rounded-md divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {crewEdit.members.length === 0 ? (
                    <li className="px-3 py-3 text-xs text-gray-500 text-center">멤버가 없습니다.</li>
                  ) : (
                    crewEdit.members.map((m) => (
                      <li key={m.id} className="px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                        <span className={m.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}>
                          {m.name}
                          {m.phone ? ` · ${m.phone}` : ''}
                          {m.isGroupLeader ? (
                            <span className="ml-1 text-indigo-700 font-medium">(그룹장)</span>
                          ) : null}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {!m.isGroupLeader ? (
                            <button
                              type="button"
                              className={memberRowBtnPrimary}
                              onClick={() =>
                                void crewMemberMutate(async () => {
                                  if (!token) return;
                                  await setTeamCrewGroupMemberLeader(token, crewEdit.id, m.teamMemberId, true);
                                })
                              }
                            >
                              그룹장
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={memberRowBtn}
                              onClick={() =>
                                void crewMemberMutate(async () => {
                                  if (!token) return;
                                  await setTeamCrewGroupMemberLeader(token, crewEdit.id, m.teamMemberId, false);
                                })
                              }
                            >
                              그룹장 해제
                            </button>
                          )}
                          <button
                            type="button"
                            className={memberRowBtnDanger}
                            onClick={() =>
                              void crewMemberMutate(async () => {
                                if (!token) return;
                                await removeTeamCrewGroupMember(token, crewEdit.id, m.teamMemberId);
                              })
                            }
                          >
                            제외
                          </button>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                <p className="text-fluid-2xs text-gray-500 mt-2">
                  날짜별 투입 가능 인원은 크루 계정으로 로그인한 뒤 「일자 명단」 메뉴에서만 편집합니다.
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={crewEditBusy}
                  onClick={() => setCrewEdit(null)}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-40"
                  disabled={crewEditBusy}
                  onClick={() => void submitCrewEdit()}
                >
                  {crewEditBusy ? '저장 중…' : '그룹 정보 저장'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {crewDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="crew-del-title"
          >
            <div className="relative w-full max-w-sm rounded-lg bg-white shadow-lg border border-gray-200 p-5">
              <ModalCloseButton
                onClick={() => {
                  setCrewDelete(null);
                  setCrewDeletePw('');
                }}
                disabled={crewDeleteBusy}
              />
              <h2 id="crew-del-title" className="text-base font-semibold text-gray-900 pr-10">
                크루 그룹 삭제
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                <strong className="font-medium text-gray-800">{crewDelete.label}</strong> 그룹과 멤버·일자 명단 데이터를
                삭제합니다. 관리자 비밀번호를 입력하세요.
              </p>
              <input
                type="password"
                autoComplete="current-password"
                value={crewDeletePw}
                onChange={(e) => setCrewDeletePw(e.target.value)}
                className="mt-3 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="비밀번호"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => {
                    setCrewDelete(null);
                    setCrewDeletePw('');
                  }}
                  disabled={crewDeleteBusy}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-40"
                  disabled={crewDeleteBusy || !crewDeletePw.trim()}
                  onClick={() => void submitCrewDelete()}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
