import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useSearchParams } from 'react-router-dom';
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
  uploadTeamMemberStaffIdCard,
  deleteTeamMemberStaffIdCard,
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
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { CrewGroupPolicyFields, crewGroupPolicySummary } from '../../components/admin/CrewGroupPolicyFields';
import {
  TeamMemberNationalityFields,
  teamMemberNationalityBadge,
} from '../../components/admin/TeamMemberNationalityFields';
import type { CrewGroupAvailabilityMode, CrewUiLanguage } from '@shared/crewGroupSettings';
import { teamMemberAltNameField, type TeamMemberNationality } from '@shared/teamMemberNationality';

/** 팀 크루 그룹 섹션 도움말 */
const CREW_GROUP_SECTION_HELP =
  '현장 인원이 같은 아이디로 로그인해 동일 정보를 보게 할 그룹입니다. 멤버는 아래 팀원 목록(전사 풀)에서만 추가합니다.\n\n날짜별 일할 수 있는 인원은 크루 공유 로그인(/crew) 후 「일자 명단」에서 그룹장이 지정합니다.';

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

/** 급여 주기 표시용 (툴팁에는 전체 YMD 사용) */
function formatPayCycleRangeShort(startYmd: string, endYmd: string): string {
  const [sy, sm, sd] = startYmd.split('-');
  const [ey, em, ed] = endYmd.split('-');
  const a = `${Number(sm)}/${Number(sd)}`;
  const b = `${Number(em)}/${Number(ed)}`;
  if (sy === ey) return `${a}~${b}`;
  return `${sy.slice(2)}.${a}~${ey.slice(2)}.${b}`;
}

const MEMBER_LIST_TABS = ['active', 'resigned'] as const;
type MemberListTabId = (typeof MEMBER_LIST_TABS)[number];

function memberListTabLabel(id: MemberListTabId): string {
  return id === 'active' ? '재직' : '퇴사자';
}

export function AdminTeamsPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const memberListTab: MemberListTabId = useMemo(() => {
    const raw = searchParams.get('memberTab');
    return raw === 'resigned' ? 'resigned' : 'active';
  }, [searchParams]);
  const setMemberListTab = useCallback(
    (tab: MemberListTabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'active') next.delete('memberTab');
          else next.set('memberTab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [activePoolMembers, setActivePoolMembers] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [memberForm, setMemberForm] = useState({
    nationality: 'KO' as TeamMemberNationality,
    name: '',
    nameTh: '',
    phone: '',
  });
  const [memberRegisterOpen, setMemberRegisterOpen] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);

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
    nationality: TeamMemberNationality;
    name: string;
    nameTh: string;
    phone: string;
    hireDate: string;
    resignationDate: string;
    monthlyPayDayInput: string;
    payAmountPerJobInput: string;
    staffIdCardUrl: string | null;
  } | null>(null);
  const [editMemberSaving, setEditMemberSaving] = useState(false);
  const [memberStaffIdCardBusy, setMemberStaffIdCardBusy] = useState(false);
  const memberStaffIdCardInputRef = useRef<HTMLInputElement>(null);

  /** 팀원 목록 재정렬 중 (위로/아래로) */
  const [memberOrderBusy, setMemberOrderBusy] = useState(false);

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
    availabilityMode: 'DAY_OFF' as CrewGroupAvailabilityMode,
    crewUiLanguage: 'KO' as CrewUiLanguage,
    allowCrewDayOffEdit: false,
    settingsPassword: '',
    adminPassword: '',
  });
  const [crewCreateBusy, setCrewCreateBusy] = useState(false);

  const [crewEditForm, setCrewEditForm] = useState({
    name: '',
    phone: '',
    loginId: '',
    availabilityMode: 'DAY_OFF' as CrewGroupAvailabilityMode,
    crewUiLanguage: 'KO' as CrewUiLanguage,
    allowCrewDayOffEdit: false,
    isActive: true,
    newPassword: '',
    newSettingsPassword: '',
    clearSettingsPassword: false,
    adminPassword: '',
  });
  const [crewEditBusy, setCrewEditBusy] = useState(false);
  const [crewAddMemberId, setCrewAddMemberId] = useState('');
  /** 크루 그룹 편집 모달 — 멤버별 태국어 표시명 초안 */
  const [crewNameThDraft, setCrewNameThDraft] = useState<Record<string, string>>({});
  const [crewDisplayNameSaving, setCrewDisplayNameSaving] = useState(false);

  const memberRowBtn =
    'px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-white text-gray-800 hover:bg-gray-50 whitespace-nowrap';
  const memberRowBtnPrimary =
    'px-2.5 py-1.5 text-xs border border-blue-200 rounded bg-white text-blue-800 hover:bg-blue-50 whitespace-nowrap';
  const memberRowBtnDanger =
    'px-2.5 py-1.5 text-xs border border-red-100 rounded bg-white text-red-700 hover:bg-red-50 whitespace-nowrap';

  const refresh = async () => {
    if (!token) return;
    setApiError(null);
    const employmentStatus = memberListTab === 'resigned' ? 'resigned' : 'active';
    try {
      const pool = await getPoolTeamMembers(token, null, { lite: true, employmentStatus });
      setMembers(pool.items);
      setLoading(false);
      void getPoolTeamMembers(token, null, { lite: false, employmentStatus })
        .then((full) => setMembers(full.items))
        .catch(() => {
          /* 급여주기 집계만 실패 — 목록은 lite로 이미 표시 */
        });
      const activePool = await getPoolTeamMembers(token, null, { lite: true, employmentStatus: 'active' });
      setActivePoolMembers(activePool.items);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
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

  /** 현재 목록 순서대로 sortOrder 0..n-1 저장 */
  const applyPoolMemberOrder = async (reordered: TeamMemberItem[]) => {
    if (!token) return;
    setMemberOrderBusy(true);
    try {
      await Promise.all(
        reordered.map((mem, idx) => updatePoolTeamMember(token, mem.id, { sortOrder: idx }))
      );
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '순서 저장에 실패했습니다.');
    } finally {
      setMemberOrderBusy(false);
    }
  };

  const movePoolMemberInList = async (fromIndex: number, delta: -1 | 1) => {
    const toIndex = fromIndex + delta;
    if (toIndex < 0 || toIndex >= members.length) return;
    const arr = [...members];
    const [row] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, row);
    await applyPoolMemberOrder(arr);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setCrewLoading(false);
      return;
    }
    refresh();
  }, [token, memberListTab]);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((u: { isTenantOwner?: boolean; isSuperAdmin?: boolean }) => {
        setIsTenantOwner(Boolean(u.isTenantOwner ?? u.isSuperAdmin));
      })
      .catch(() => setIsTenantOwner(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setCrewLoading(false);
      return;
    }
    refreshCrew();
  }, [token]);

  useEffect(() => {
    if (!crewEdit) {
      setCrewNameThDraft({});
      return;
    }
    const d: Record<string, string> = {};
    for (const m of crewEdit.members) d[m.teamMemberId] = (m.nameTh ?? '').trim();
    setCrewNameThDraft(d);
  }, [crewEdit]);

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
      const nameTh = editMemberModal.nameTh.trim() || null;
      const payDayRaw = editMemberModal.monthlyPayDayInput.trim();
      let monthlyPayDay: number | null;
      if (payDayRaw === '') monthlyPayDay = null;
      else {
        const d = parseInt(payDayRaw, 10);
        if (!Number.isFinite(d) || d < 1 || d > 31) {
          alert('월급 지급일은 1~31 사이 숫자로 입력하거나 비워 두세요.');
          return;
        }
        monthlyPayDay = d;
      }
      const payJobRaw = editMemberModal.payAmountPerJobInput.replace(/,/g, '').trim();
      let payAmountPerJob: number | null;
      if (payJobRaw === '') payAmountPerJob = null;
      else {
        const n = parseInt(payJobRaw, 10);
        if (!Number.isFinite(n) || n < 0) {
          alert('일당(1일 급여)는 0 이상 정수(원)로 입력하거나 비워 두세요.');
          return;
        }
        payAmountPerJob = n;
      }
      await updatePoolTeamMember(token, editMemberModal.memberId, {
        name,
        phone,
        nationality: editMemberModal.nationality,
        nameTh,
        monthlyPayDay,
        payAmountPerJob,
        ...(isTenantOwner
          ? {
              hireDate: editMemberModal.hireDate.trim() || null,
              resignationDate: editMemberModal.resignationDate.trim() || null,
            }
          : {}),
      });
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
      availabilityMode: g.availabilityMode ?? (g.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF'),
      crewUiLanguage: g.crewUiLanguage ?? 'KO',
      allowCrewDayOffEdit: g.allowCrewDayOffEdit ?? false,
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
        availabilityMode: crewCreateForm.availabilityMode,
        crewUiLanguage: crewCreateForm.crewUiLanguage,
        allowCrewDayOffEdit: crewCreateForm.allowCrewDayOffEdit,
        settingsPassword: settingsPassword || null,
        adminPassword,
      });
      setCrewCreateOpen(false);
      setCrewCreateForm({
        name: '',
        loginId: '',
        password: '',
        phone: '',
        availabilityMode: 'DAY_OFF',
        crewUiLanguage: 'KO',
        allowCrewDayOffEdit: false,
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

  const saveCrewMemberDisplayNames = async () => {
    if (!token || !crewEdit) return;
    setCrewDisplayNameSaving(true);
    try {
      for (const m of crewEdit.members) {
        const next = (crewNameThDraft[m.teamMemberId] ?? '').trim();
        const prev = (m.nameTh ?? '').trim();
        if (next === prev) continue;
        await updatePoolTeamMember(token, m.teamMemberId, { nameTh: next || null });
      }
      const items = await refreshCrew();
      syncCrewEditFromList(items, crewEdit.id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '표시명 저장에 실패했습니다.');
    } finally {
      setCrewDisplayNameSaving(false);
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
    if (crewEditForm.availabilityMode !== orig.availabilityMode) {
      body.availabilityMode = crewEditForm.availabilityMode;
    }
    if (crewEditForm.crewUiLanguage !== orig.crewUiLanguage) {
      body.crewUiLanguage = crewEditForm.crewUiLanguage;
    }
    if (crewEditForm.allowCrewDayOffEdit !== orig.allowCrewDayOffEdit) {
      body.allowCrewDayOffEdit = crewEditForm.allowCrewDayOffEdit;
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
        availabilityMode: updated.availabilityMode ?? (updated.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF'),
        crewUiLanguage: updated.crewUiLanguage ?? 'KO',
        allowCrewDayOffEdit: updated.allowCrewDayOffEdit ?? false,
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

  const activeMemberCount = members.filter((m) => m.isActive).length;
  const canRegisterMember = memberListTab === 'active' && activeMemberCount < 100;

  const openMemberRegisterModal = () => {
    setMemberForm({ nationality: 'KO', name: '', nameTh: '', phone: '' });
    setMemberRegisterOpen(true);
  };

  const poolMemberNationality = (memberId: string): TeamMemberNationality =>
    members.find((m) => m.id === memberId)?.nationality ??
    activePoolMembers.find((m) => m.id === memberId)?.nationality ??
    'KO';

  const submitMemberRegister = async () => {
    if (!token || !memberForm.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    setRegisterBusy(true);
    try {
      await addPoolTeamMember(token, {
        name: memberForm.name.trim(),
        nationality: memberForm.nationality,
        nameTh: memberForm.nameTh.trim() || undefined,
        phone: memberForm.phone.trim() || undefined,
      });
      setMemberForm({ nationality: 'KO', name: '', nameTh: '', phone: '' });
      setMemberRegisterOpen(false);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setRegisterBusy(false);
    }
  };

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
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-gray-800">팀 크루 그룹 (공유 로그인)</h2>
            <HelpTooltip className="shrink-0" text={CREW_GROUP_SECTION_HELP} />
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
                    <th className="border-b border-gray-200 px-2 py-2 text-center">가용·언어</th>
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
                        <td className="border-b border-gray-100 px-2 py-2 text-center text-fluid-2xs" title={crewGroupPolicySummary(g)}>
                          {crewGroupPolicySummary(g)}
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
                      {crewGroupPolicySummary(g)} · 멤버 {g.members.length}명
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">팀원 목록</h2>
              <p className="text-xs text-gray-500 mt-1">
                {memberListTab === 'active'
                  ? '재직 중인 현장 팀원입니다. 퇴사일을 지정하면 해당일부터 스케줄·배정에서 제외되고 퇴사자 탭으로 이동합니다.'
                  : '퇴사일이 지난 팀원입니다. 과거 스케줄·접수 기록은 유지됩니다. 복직 시 정보 수정에서 퇴사일을 비우세요.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canRegisterMember ? (
                <button
                  type="button"
                  onClick={openMemberRegisterModal}
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                >
                  팀원 등록
                </button>
              ) : null}
              <nav className="inline-flex shrink-0 rounded border border-gray-200 bg-gray-50 p-0.5" role="tablist" aria-label="팀원 재직 구분">
              {MEMBER_LIST_TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={memberListTab === id}
                  onClick={() => setMemberListTab(id)}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium min-h-[36px] ${
                    memberListTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {memberListTabLabel(id)}
                </button>
              ))}
            </nav>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3 hidden sm:block">
            각 행에서 순서(위로·아래로)·휴무일·정보 수정·사용 중지·삭제를 할 수 있습니다.
            월 급여표 산정용으로 「정보 수정」에서 매월 지급일·일당(1일 급여)을 설정할 수 있습니다.
          </p>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-md px-3 py-4 text-center mb-3">
              아직 등록된 팀원이 없습니다. 상단 「팀원 등록」으로 추가하세요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md mb-3">
              {members.map((m, index) => (
                <li key={m.id} className="px-3 py-3 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex gap-2 sm:gap-3 flex-1">
                      <span
                        className="text-fluid-xs text-gray-400 tabular-nums shrink-0 w-6 text-center pt-0.5 sm:pt-1"
                        title="표시 순서"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={m.isActive ? 'font-medium text-gray-900' : 'text-gray-400 line-through'}>
                            {m.name}
                          </span>
                          {teamMemberNationalityBadge(m.nationality ?? 'KO') ? (
                            <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                              {teamMemberNationalityBadge(m.nationality ?? 'KO')}
                            </span>
                          ) : null}
                          {m.monthlyPayDay != null &&
                          m.payCycleJobCount != null &&
                          m.payCycleStartYmd &&
                          m.payCycleEndYmd ? (
                            <span
                              className="text-xs text-blue-800 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded tabular-nums shrink-0"
                              title={`급여 주기(KST): ${m.payCycleStartYmd} ~ ${m.payCycleEndYmd}. 접수 예약일 기준·현장 투입 메모(이름) 일치 건만 집계합니다.`}
                            >
                              급여주기 {m.payCycleJobCount}건 ({formatPayCycleRangeShort(m.payCycleStartYmd, m.payCycleEndYmd)})
                            </span>
                          ) : null}
                          {(m.nameTh ?? '').trim() ? (
                            <span className="text-xs text-gray-500 w-full sm:w-auto">({(m.nameTh ?? '').trim()})</span>
                          ) : null}
                          {m.phone ? (
                            <span className="text-gray-500 text-xs">{m.phone}</span>
                          ) : (
                            <span className="text-xs text-gray-400">연락처 없음</span>
                          )}
                          {m.resignationDate ? (
                            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded tabular-nums">
                              퇴사 예정 {m.resignationDate}
                            </span>
                          ) : null}
                          {!m.isActive && (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                              사용 안 함
                            </span>
                          )}
                        </div>
                        <div className="text-fluid-xs text-gray-600 mt-1 tabular-nums">
                          급여:{' '}
                          {m.monthlyPayDay != null ? `매월 ${m.monthlyPayDay}일 지급` : '지급일 미설정'} ·{' '}
                          {m.payAmountPerJob != null
                            ? `일당 ${Number(m.payAmountPerJob).toLocaleString('ko-KR')}원`
                            : '일당 미설정'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0 sm:pl-0 pl-8">
                      <button
                        type="button"
                        className={`${memberRowBtn} disabled:opacity-40`}
                        disabled={memberOrderBusy || index === 0}
                        title="목록에서 한 칸 위로"
                        aria-label={`${m.name} 순서 위로`}
                        onClick={() => void movePoolMemberInList(index, -1)}
                      >
                        위로
                      </button>
                      <button
                        type="button"
                        className={`${memberRowBtn} disabled:opacity-40`}
                        disabled={memberOrderBusy || index >= members.length - 1}
                        title="목록에서 한 칸 아래로"
                        aria-label={`${m.name} 순서 아래로`}
                        onClick={() => void movePoolMemberInList(index, 1)}
                      >
                        아래로
                      </button>
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
                            nationality: m.nationality ?? 'KO',
                            name: m.name,
                            nameTh: (m.nameTh ?? '').trim(),
                            phone: m.phone ?? '',
                            hireDate: m.hireDate ?? '',
                            resignationDate: m.resignationDate ?? '',
                            monthlyPayDayInput: m.monthlyPayDay != null ? String(m.monthlyPayDay) : '',
                            payAmountPerJobInput:
                              m.payAmountPerJob != null ? String(m.payAmountPerJob) : '',
                            staffIdCardUrl: m.staffIdCardUrl ?? null,
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
          {memberListTab === 'active' && activeMemberCount >= 100 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              활성 팀원이 상한(100명)에 도달했습니다. 사용 중지 후 추가하거나 관리자에게 문의하세요.
            </p>
          )}
        </section>
      )}

      {memberRegisterOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="member-register-title"
            onClick={() => !registerBusy && setMemberRegisterOpen(false)}
          >
            <div
              className="relative w-full max-w-md rounded-lg bg-white shadow-lg border border-gray-200 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <ModalCloseButton
                onClick={() => !registerBusy && setMemberRegisterOpen(false)}
                disabled={registerBusy}
              />
              <h2 id="member-register-title" className="text-base font-semibold text-gray-900 pr-10">
                팀원 등록
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                현장 투입 인원을 전사 풀에 추가합니다. 등록 후 목록에서 휴무일·급여·크루 그룹 배정을 설정할 수 있습니다.
              </p>
              <form
                id="member-register-form"
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitMemberRegister();
                }}
              >
                <TeamMemberNationalityFields
                  idPrefix="member-register"
                  nameAutoFocus
                  value={memberForm}
                  onChange={setMemberForm}
                />
              </form>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={registerBusy}
                  onClick={() => setMemberRegisterOpen(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="member-register-form"
                  className="px-3 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-40"
                  disabled={registerBusy}
                >
                  {registerBusy ? '등록 중…' : '등록'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {editMemberModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
            role="dialog"
            aria-modal
            aria-labelledby="edit-member-title"
          >
            <div className="relative w-full max-w-md rounded-lg bg-white shadow-lg border border-gray-200 p-5">
              <ModalCloseButton
                onClick={() => setEditMemberModal(null)}
                disabled={editMemberSaving}
              />
              <h2 id="edit-member-title" className="text-base font-semibold text-gray-900 pr-10">
                팀원 정보 수정
              </h2>
              <div className="mt-4 space-y-3">
                <TeamMemberNationalityFields
                  idPrefix="member-edit"
                  value={{
                    nationality: editMemberModal.nationality,
                    name: editMemberModal.name,
                    nameTh: editMemberModal.nameTh,
                    phone: editMemberModal.phone,
                  }}
                  onChange={(next) =>
                    setEditMemberModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            nationality: next.nationality,
                            name: next.name,
                            nameTh: next.nameTh,
                            phone: next.phone,
                          }
                        : null,
                    )
                  }
                />
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-800">사원증 사진</p>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    모바일 인증용으로 관리자가 등록합니다. (Cloudinary 저장) 로컬에서 실패하면{' '}
                    <code className="text-[10px]">server/.env</code>의 CLOUDINARY 설정을 확인하세요.
                  </p>
                  {editMemberModal.staffIdCardUrl ? (
                    <img
                      src={editMemberModal.staffIdCardUrl}
                      alt=""
                      className="max-h-48 w-full rounded border border-gray-200 bg-white object-contain"
                    />
                  ) : (
                    <p className="text-xs text-gray-500">등록된 사진이 없습니다.</p>
                  )}
                  <input
                    ref={memberStaffIdCardInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    tabIndex={-1}
                    disabled={memberStaffIdCardBusy || editMemberSaving}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      const inputEl = e.target;
                      void (async () => {
                        if (!f) return;
                        if (!token || !editMemberModal) {
                          alert('로그인이 필요합니다.');
                          return;
                        }
                        setMemberStaffIdCardBusy(true);
                        try {
                          const { staffIdCardUrl } = await uploadTeamMemberStaffIdCard(
                            token,
                            editMemberModal.memberId,
                            f
                          );
                          setEditMemberModal((prev) => (prev ? { ...prev, staffIdCardUrl } : null));
                          await refresh();
                        } catch (err) {
                          alert(err instanceof Error ? err.message : '업로드에 실패했습니다.');
                        } finally {
                          setMemberStaffIdCardBusy(false);
                          inputEl.value = '';
                        }
                      })();
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={memberStaffIdCardBusy || editMemberSaving}
                      className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => memberStaffIdCardInputRef.current?.click()}
                    >
                      {memberStaffIdCardBusy ? '처리 중…' : editMemberModal.staffIdCardUrl ? '사진 교체' : '사진 올리기'}
                    </button>
                    {editMemberModal.staffIdCardUrl ? (
                      <button
                        type="button"
                        disabled={memberStaffIdCardBusy || editMemberSaving}
                        className="rounded border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        onClick={() => {
                          if (!token || !editMemberModal) return;
                          if (!window.confirm('사원증 사진을 삭제할까요?')) return;
                          void (async () => {
                            setMemberStaffIdCardBusy(true);
                            try {
                              await deleteTeamMemberStaffIdCard(token, editMemberModal.memberId);
                              setEditMemberModal((prev) => (prev ? { ...prev, staffIdCardUrl: null } : null));
                              await refresh();
                            } catch (err) {
                              alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
                            } finally {
                              setMemberStaffIdCardBusy(false);
                            }
                          })();
                        }}
                      >
                        사진 삭제
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-600 mb-2">
                    월 급여표: 근무일 수 × 일당 (같은 날 여러 현장은 1일로 집계)
                  </p>
                  {isTenantOwner ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">입사일 (포함)</label>
                        <input
                          type="date"
                          value={editMemberModal.hireDate}
                          onChange={(e) =>
                            setEditMemberModal((prev) =>
                              prev ? { ...prev, hireDate: e.target.value } : null
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">퇴사일 (해당일 미포함)</label>
                        <input
                          type="date"
                          value={editMemberModal.resignationDate}
                          onChange={(e) =>
                            setEditMemberModal((prev) =>
                              prev ? { ...prev, resignationDate: e.target.value } : null
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">해당일부터 스케줄·배정에서 제외됩니다.</p>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">매월 지급일 (1~31, 비우면 미설정)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={31}
                        value={editMemberModal.monthlyPayDayInput}
                        onChange={(e) =>
                          setEditMemberModal((prev) =>
                            prev ? { ...prev, monthlyPayDayInput: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                        placeholder="예: 25"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">일당 · 1일 급여 (원, 비우면 미설정)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editMemberModal.payAmountPerJobInput}
                        onChange={(e) =>
                          setEditMemberModal((prev) =>
                            prev ? { ...prev, payAmountPerJobInput: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums text-right"
                        placeholder="예: 50000"
                      />
                    </div>
                  </div>
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
                <CrewGroupPolicyFields
                  idPrefix="crew-create"
                  value={{
                    availabilityMode: crewCreateForm.availabilityMode,
                    crewUiLanguage: crewCreateForm.crewUiLanguage,
                    allowCrewDayOffEdit: crewCreateForm.allowCrewDayOffEdit,
                  }}
                  onChange={(next) =>
                    setCrewCreateForm((p) => ({
                      ...p,
                      availabilityMode: next.availabilityMode,
                      crewUiLanguage: next.crewUiLanguage,
                      allowCrewDayOffEdit: next.allowCrewDayOffEdit,
                    }))
                  }
                />
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
                    가용 방식이 <strong>배정(일자 명단)</strong>일 때, 그룹장이 크루 화면에서 일자 명단을 저장할 때만 이
                    비밀번호를 추가로 입력합니다.
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
                <CrewGroupPolicyFields
                  idPrefix="crew-edit"
                  value={{
                    availabilityMode: crewEditForm.availabilityMode,
                    crewUiLanguage: crewEditForm.crewUiLanguage,
                    allowCrewDayOffEdit: crewEditForm.allowCrewDayOffEdit,
                  }}
                  onChange={(next) =>
                    setCrewEditForm((p) => ({
                      ...p,
                      availabilityMode: next.availabilityMode,
                      crewUiLanguage: next.crewUiLanguage,
                      allowCrewDayOffEdit: next.allowCrewDayOffEdit,
                    }))
                  }
                />
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
                    {activePoolMembers
                      .filter((m) => !crewEdit.members.some((cm) => cm.teamMemberId === m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {(m.nameTh ?? '').trim() ? ` · ${(m.nameTh ?? '').trim()}` : ''}
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
                          <span className="font-medium">{m.name}</span>
                          {m.isGroupLeader ? (
                            <span className="ml-1 text-indigo-700 font-medium">(그룹장)</span>
                          ) : null}
                          {(m.nameTh ?? '').trim() ? (
                            <span className="block text-[0.65rem] text-gray-500 font-normal mt-0.5 not-italic">
                              {(m.nameTh ?? '').trim()}
                            </span>
                          ) : null}
                          {m.phone ? (
                            <span className="block text-[0.65rem] text-gray-500 mt-0.5">{m.phone}</span>
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

                <details className="mt-4 rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2">
                  <summary className="text-xs font-medium text-gray-800 cursor-pointer select-none">
                    크루 앱 보조 표시명
                  </summary>
                  <p className="text-fluid-2xs text-gray-600 mt-2 mb-2 leading-snug">
                    태국·몽골 국적 팀원은 한글 이름 아래 보조 표기를 넣을 수 있습니다. 전사 팀원 풀의 「정보 수정」에서도
                    국적과 함께 편집할 수 있습니다.
                  </p>
                  {crewEdit.members.filter((m) => poolMemberNationality(m.teamMemberId) !== 'KO').length === 0 ? (
                    <p className="text-xs text-gray-500">보조 표시명이 필요한 태국·몽골 국적 멤버가 없습니다.</p>
                  ) : (
                    <ul className="space-y-2 max-h-56 overflow-y-auto border border-gray-100 rounded bg-white p-2">
                      {crewEdit.members
                        .filter((m) => poolMemberNationality(m.teamMemberId) !== 'KO')
                        .map((m) => {
                          const nat = poolMemberNationality(m.teamMemberId);
                          const alt = teamMemberAltNameField(nat);
                          return (
                        <li key={m.teamMemberId} className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs">
                          <span className={`shrink-0 sm:w-28 font-medium ${m.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                            {m.name}
                            {teamMemberNationalityBadge(nat) ? (
                              <span className="ml-1 text-gray-500 font-normal">({teamMemberNationalityBadge(nat)})</span>
                            ) : null}
                          </span>
                          <input
                            type="text"
                            className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-xs"
                            placeholder={alt.placeholder}
                            value={crewNameThDraft[m.teamMemberId] ?? ''}
                            onChange={(e) =>
                              setCrewNameThDraft((prev) => ({
                                ...prev,
                                [m.teamMemberId]: e.target.value,
                              }))
                            }
                          />
                        </li>
                          );
                        })}
                    </ul>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={
                        crewDisplayNameSaving ||
                        crewEdit.members.filter((m) => poolMemberNationality(m.teamMemberId) !== 'KO').length === 0
                      }
                      className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                      onClick={() => void saveCrewMemberDisplayNames()}
                    >
                      {crewDisplayNameSaving ? '저장 중…' : '표시명 저장'}
                    </button>
                  </div>
                </details>

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
