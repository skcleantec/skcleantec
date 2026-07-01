import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkSetTeamLeaderAllowSelfDayOffEdit,
  uploadUserStaffIdCard,
  deleteUserStaffIdCard,
  type TeamLeaderGeneralSettlementModeApi,
  type UserItem,
} from '../../api/users';
import type { MarketerAdminLevel } from '@shared/marketerAdminLevel';
import { MARKETER_ADMIN_LEVEL_LABEL } from '@shared/marketerAdminLevel';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import { listOperatingCompanies, type OperatingCompanyItem } from '../../api/operatingCompanies';
import { listServiceZones, type ServiceZoneItem } from '../../api/serviceZones';
import { OperatingCompanyBadge } from '../../components/admin/OperatingCompanyBadge';
import {
  UserOperatingCompanyFields,
  defaultUserOperatingCompanyForm,
  userOperatingCompanyFormFromUser,
  type UserOperatingCompanyFormValue,
} from '../../components/admin/UserOperatingCompanyFields';
import {
  ServiceZoneBadges,
  UserServiceZoneFields,
  userServiceZoneFormFromUser,
  type UserServiceZoneFormValue,
} from '../../components/admin/UserServiceZoneFields';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';

type UserRole = 'TEAM_LEADER' | 'MARKETER' | 'OFFICE_STAFF';

function userRoleLabel(role: UserItem['role']): string {
  if (role === 'MARKETER') return '마케터';
  if (role === 'OFFICE_STAFF') return '사무직';
  return '팀장';
}

function OperatingCompanyBadges({ items }: { items?: UserItem['operatingCompanies'] }) {
  if (!items?.length) {
    return <span className="text-fluid-2xs text-gray-400">브랜드 —</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((oc) => (
        <OperatingCompanyBadge
          key={oc.operatingCompanyId}
          company={{
            id: oc.operatingCompanyId,
            name: oc.name,
            slug: oc.slug,
            isActive: oc.isActive,
            badgeColorKey: oc.config?.branding?.badgeColorKey ?? null,
          }}
          suffix={oc.isPrimary ? ' ·기본' : null}
        />
      ))}
    </span>
  );
}

/** 접수목록과 동일 톤 — 모바일 카드 외곽 */
const userMobileCardShell =
  'rounded-xl border border-gray-200 bg-white text-left shadow-sm outline-none transition hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-400 touch-manipulation overflow-hidden';

function formatUserPayrollSalaryCell(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('ko-KR')}원`;
}

function formatUserPayrollPayDayCell(v: number | null | undefined): string {
  if (v == null) return '말일';
  return `${v}일`;
}

/** 저장값 만분율(0~10000) → 입력란 표시용 회사 몫 % */
function companyShareBpsToPercentInput(bps: number): string {
  const p = bps / 100;
  if (!Number.isFinite(p)) return '';
  return Number.isInteger(p) ? String(p) : String(p);
}

/** 입력란 % (0~100, 소수 허용) → API 만분율 */
function parseAdditionalReceiptCompanySharePercent(
  raw: string,
): { ok: true; bps: number | null } | { ok: false; message: string } {
  const t = raw.trim().replace(/,/g, '');
  if (t === '') return { ok: true, bps: null };
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return { ok: false, message: '추가결재 회사 몫은 숫자로 입력해 주세요. (예: 50)' };
  }
  if (n < 0 || n > 100) {
    return { ok: false, message: '추가결재 회사 몫은 0 이상 100 이하(%)만 입력할 수 있습니다.' };
  }
  return { ok: true, bps: Math.round(n * 100) };
}

type RegisterFormState = {
  email: string;
  password: string;
  name: string;
  phone: string;
  payrollMonthlySalary: string;
  payrollPayDay: string;
  /** 팀장 등록 전용 — 빈 문자열이면 미설정 */
  teamLeaderGeneralSettlementMode: '' | TeamLeaderGeneralSettlementModeApi;
  teamLeaderGeneralSettlementValue: string;
  /** 추가결재 회사 몫 — 0~100 숫자만 (%). 빈 문자열이면 미설정 */
  teamLeaderAdditionalReceiptCompanySharePercent: string;
};

function emptyRegisterForm(): RegisterFormState {
  return {
    email: '',
    password: '',
    name: '',
    phone: '',
    payrollMonthlySalary: '',
    payrollPayDay: '',
    teamLeaderGeneralSettlementMode: '',
    teamLeaderGeneralSettlementValue: '',
    teamLeaderAdditionalReceiptCompanySharePercent: '',
  };
}

type EditFormState = {
  email: string;
  name: string;
  phone: string;
  password: string;
  hireDate: string;
  resignationDate: string;
  marketerAdminLevel: MarketerAdminLevel;
  payrollMonthlySalary: string;
  payrollPayDay: string;
  teamLeaderGeneralSettlementMode: '' | TeamLeaderGeneralSettlementModeApi;
  teamLeaderGeneralSettlementValue: string;
  teamLeaderAdditionalReceiptCompanySharePercent: string;
};

function emptyEditForm(): EditFormState {
  return {
    email: '',
    name: '',
    phone: '',
    password: '',
    hireDate: '',
    resignationDate: '',
    marketerAdminLevel: 'NONE',
    payrollMonthlySalary: '',
    payrollPayDay: '',
    teamLeaderGeneralSettlementMode: '',
    teamLeaderGeneralSettlementValue: '',
    teamLeaderAdditionalReceiptCompanySharePercent: '',
  };
}

const USER_REGISTER_TABS = ['leader', 'marketer', 'office', 'resigned'] as const;
type UserRegisterTabId = (typeof USER_REGISTER_TABS)[number];

function parseUserRegisterTab(raw: string | null): UserRegisterTabId | null {
  if (raw === 'leader' || raw === 'marketer' || raw === 'office' || raw === 'resigned') return raw;
  return null;
}

function userRegisterTabLabel(id: UserRegisterTabId): string {
  if (id === 'leader') return '팀장';
  if (id === 'marketer') return '마케터';
  if (id === 'office') return '사무직';
  return '퇴사자';
}

function resolveMarketerAdminLevel(item: UserItem): MarketerAdminLevel {
  if (item.marketerAdminLevel === 'LIMITED' || item.marketerAdminLevel === 'FULL') {
    return item.marketerAdminLevel;
  }
  return item.hasAdminPrivileges ? 'LIMITED' : 'NONE';
}

function marketerAdminLevelBadge(level: MarketerAdminLevel) {
  if (level === 'NONE') return null;
  const cls =
    level === 'FULL'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-sky-100 text-sky-800';
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {level === 'FULL' ? '전체' : '일부'}
    </span>
  );
}

export function AdminTeamLeadersPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const userTab: UserRegisterTabId = useMemo(
    () => parseUserRegisterTab(searchParams.get('tab')) ?? 'leader',
    [searchParams],
  );
  const setUserTab = useCallback(
    (tab: UserRegisterTabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'leader') next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  const [officeStaff, setOfficeStaff] = useState<UserItem[]>([]);
  const [resignedUsers, setResignedUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<'team' | 'marketer' | 'office' | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(() => emptyEditForm());
  const [editLoading, setEditLoading] = useState(false);
  const [staffIdCardBusy, setStaffIdCardBusy] = useState(false);
  const staffIdCardInputRef = useRef<HTMLInputElement>(null);
  const [dayOffSwitchId, setDayOffSwitchId] = useState<string | null>(null);
  const [bulkDayOffLoading, setBulkDayOffLoading] = useState(false);
  const [form, setForm] = useState<RegisterFormState>(() => emptyRegisterForm());
  const [operatingCompanies, setOperatingCompanies] = useState<OperatingCompanyItem[]>([]);
  const [ocForm, setOcForm] = useState<UserOperatingCompanyFormValue>({
    operatingCompanyIds: [],
    primaryOperatingCompanyId: '',
  });
  const [editOcForm, setEditOcForm] = useState<UserOperatingCompanyFormValue>({
    operatingCompanyIds: [],
    primaryOperatingCompanyId: '',
  });
  const [serviceZones, setServiceZones] = useState<ServiceZoneItem[]>([]);
  const [szForm, setSzForm] = useState<UserServiceZoneFormValue>({ serviceZoneIds: [] });
  const [editSzForm, setEditSzForm] = useState<UserServiceZoneFormValue>({ serviceZoneIds: [] });

  const refresh = (): Promise<void> => {
    if (!token) return Promise.resolve();
    setApiError(null);
    return Promise.all([
      getUsers(token, 'TEAM_LEADER', { scope: 'management', employmentStatus: 'active' }),
      getUsers(token, 'MARKETER', { scope: 'management', employmentStatus: 'active' }),
      getUsers(token, 'OFFICE_STAFF', { scope: 'management', employmentStatus: 'active' }),
      getUsers(token, 'TEAM_LEADER', { scope: 'management', employmentStatus: 'resigned' }),
      getUsers(token, 'MARKETER', { scope: 'management', employmentStatus: 'resigned' }),
      getUsers(token, 'OFFICE_STAFF', { scope: 'management', employmentStatus: 'resigned' }),
    ])
      .then(([teamRes, marketerRes, officeRes, resignedTl, resignedMk, resignedOf]) => {
        setTeamLeaders(teamRes);
        setMarketers(marketerRes);
        setOfficeStaff(officeRes);
        const merged = [...resignedTl, ...resignedMk, ...resignedOf].sort((a, b) => {
          const da = a.resignationDate ?? '';
          const db = b.resignationDate ?? '';
          if (da !== db) return db.localeCompare(da);
          return a.name.localeCompare(b.name, 'ko');
        });
        setResignedUsers(merged);
        setApiError(null);
      })
      .catch((err) => {
        setTeamLeaders([]);
        setMarketers([]);
        setOfficeStaff([]);
        setResignedUsers([]);
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((u: { isTenantOwner?: boolean; isSuperAdmin?: boolean }) => {
        setIsTenantOwner(Boolean(u.isTenantOwner ?? u.isSuperAdmin));
      })
      .catch(() => {
        setIsTenantOwner(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    listOperatingCompanies(token)
      .then((r) => {
        setOperatingCompanies(r.items);
        setOcForm(defaultUserOperatingCompanyForm(r.items));
      })
      .catch(() => setOperatingCompanies([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    listServiceZones(token)
      .then(setServiceZones)
      .catch(() => setServiceZones([]));
  }, [token]);

  useEffect(() => {
    setShowForm(null);
  }, [userTab]);

  const handleSubmit = async (e: React.FormEvent, role: UserRole) => {
    e.preventDefault();
    if (!token) return;
    setSubmitLoading(true);
    try {
      const payload: {
        email: string;
        password: string;
        name: string;
        phone?: string;
        role: UserRole;
        payrollMonthlySalary?: number | null;
        payrollPayDay?: number | null;
        teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementModeApi | null;
        teamLeaderGeneralSettlementValue?: number | null;
        teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
        operatingCompanyIds?: string[];
        primaryOperatingCompanyId?: string;
        serviceZoneIds?: string[];
      } = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        role,
      };

      if (role === 'TEAM_LEADER' || role === 'MARKETER' || role === 'OFFICE_STAFF') {
        const salaryTrim = form.payrollMonthlySalary.trim().replace(/,/g, '');
        if (salaryTrim !== '') {
          const n = Number(salaryTrim);
          if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
            alert('월 고정 급여는 0 이상의 정수(원)로 입력해 주세요.');
            setSubmitLoading(false);
            return;
          }
          payload.payrollMonthlySalary = n;
        }
        const dayTrim = form.payrollPayDay.trim();
        if (dayTrim !== '') {
          const d = Number.parseInt(dayTrim, 10);
          if (!Number.isFinite(d) || d < 1 || d > 31) {
            alert('급여 지급일은 1~31 사이로 입력해 주세요. 비우면 월 급여표에서 말일로 표시됩니다.');
            setSubmitLoading(false);
            return;
          }
          payload.payrollPayDay = d;
        }
      }

      if (role === 'TEAM_LEADER') {
        const modeRaw = form.teamLeaderGeneralSettlementMode;
        const valRaw = form.teamLeaderGeneralSettlementValue.trim().replace(/,/g, '');

        if (modeRaw === '') {
          if (valRaw !== '') {
            alert('일반 정산 방식을 선택한 뒤 금액·만분율을 입력해 주세요.');
            setSubmitLoading(false);
            return;
          }
          payload.teamLeaderGeneralSettlementMode = null;
          payload.teamLeaderGeneralSettlementValue = null;
        } else {
          payload.teamLeaderGeneralSettlementMode = modeRaw;
          if (valRaw === '') {
            alert(
              modeRaw === 'PERCENT_OF_GENERAL_SERVICE_BPS'
                ? '일반 서비스 금액 대비 만분율을 입력해 주세요. (예: 1500 = 15%)'
                : '건당 금액(원)을 입력해 주세요.'
            );
            setSubmitLoading(false);
            return;
          }
          const n = Number.parseInt(valRaw, 10);
          if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
            alert('일반 정산 값은 0 이상 정수(상한 1억)여야 합니다.');
            setSubmitLoading(false);
            return;
          }
          payload.teamLeaderGeneralSettlementValue = n;
        }

        const shareParsed = parseAdditionalReceiptCompanySharePercent(
          form.teamLeaderAdditionalReceiptCompanySharePercent,
        );
        if (!shareParsed.ok) {
          alert(shareParsed.message);
          setSubmitLoading(false);
          return;
        }
        payload.teamLeaderAdditionalReceiptCompanyShareBps = shareParsed.bps;
        payload.serviceZoneIds = szForm.serviceZoneIds;
      }

      if (role === 'TEAM_LEADER' || role === 'MARKETER') {
        if (ocForm.operatingCompanyIds.length === 0) {
          alert('소속 영업 브랜드를 1개 이상 선택해 주세요.');
          setSubmitLoading(false);
          return;
        }
        payload.operatingCompanyIds = ocForm.operatingCompanyIds;
        payload.primaryOperatingCompanyId = ocForm.primaryOperatingCompanyId;
      }

      await createUser(token, payload);
      setForm(emptyRegisterForm());
      setOcForm(defaultUserOperatingCompanyForm(operatingCompanies));
      setSzForm({ serviceZoneIds: [] });
      setShowForm(null);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const openEdit = (item: UserItem) => {
    setEditingUser(item);
    setEditForm({
      email: item.email,
      name: item.name,
      phone: item.phone ?? '',
      password: '',
      hireDate: item.hireDate ?? '',
      resignationDate: item.resignationDate ?? '',
      marketerAdminLevel:
        item.marketerAdminLevel === 'LIMITED' || item.marketerAdminLevel === 'FULL'
          ? item.marketerAdminLevel
          : item.hasAdminPrivileges
            ? 'LIMITED'
            : 'NONE',
      payrollMonthlySalary:
        item.payrollMonthlySalary != null ? String(item.payrollMonthlySalary) : '',
      payrollPayDay: item.payrollPayDay != null ? String(item.payrollPayDay) : '',
      teamLeaderGeneralSettlementMode:
        item.teamLeaderGeneralSettlementMode === 'FIXED_PER_JOB_WON' ||
        item.teamLeaderGeneralSettlementMode === 'PERCENT_OF_GENERAL_SERVICE_BPS'
          ? item.teamLeaderGeneralSettlementMode
          : '',
      teamLeaderGeneralSettlementValue:
        item.teamLeaderGeneralSettlementValue != null
          ? String(item.teamLeaderGeneralSettlementValue)
          : '',
      teamLeaderAdditionalReceiptCompanySharePercent:
        item.teamLeaderAdditionalReceiptCompanyShareBps != null
          ? companyShareBpsToPercentInput(item.teamLeaderAdditionalReceiptCompanyShareBps)
          : '',
    });
    setEditOcForm(userOperatingCompanyFormFromUser(operatingCompanies, item.operatingCompanies));
    setEditSzForm(userServiceZoneFormFromUser(item));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingUser) return;
    setEditLoading(true);
    try {
      const payload: {
        email: string;
        name: string;
        phone: string | null;
        password?: string;
        hireDate?: string | null;
        resignationDate?: string | null;
        payrollMonthlySalary?: number | null;
        payrollPayDay?: number | null;
        teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementModeApi | null;
        teamLeaderGeneralSettlementValue?: number | null;
        teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
        marketerAdminLevel?: MarketerAdminLevel;
        operatingCompanyIds?: string[];
        primaryOperatingCompanyId?: string;
        serviceZoneIds?: string[];
      } = {
        email: editForm.email.trim().toLowerCase(),
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      if (isTenantOwner) {
        payload.hireDate = editForm.hireDate.trim() || null;
        payload.resignationDate = editForm.resignationDate.trim() || null;
      }
      if (
        editingUser.role === 'TEAM_LEADER' ||
        editingUser.role === 'MARKETER' ||
        editingUser.role === 'OFFICE_STAFF'
      ) {
        const salaryTrim = editForm.payrollMonthlySalary.trim().replace(/,/g, '');
        if (salaryTrim === '') {
          payload.payrollMonthlySalary = null;
        } else {
          const n = Number(salaryTrim);
          if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
            alert('월 고정 급여는 0 이상의 정수(원)로 입력해 주세요.');
            setEditLoading(false);
            return;
          }
          payload.payrollMonthlySalary = n;
        }
        const dayTrim = editForm.payrollPayDay.trim();
        if (dayTrim === '') {
          payload.payrollPayDay = null;
        } else {
          const d = Number.parseInt(dayTrim, 10);
          if (!Number.isFinite(d) || d < 1 || d > 31) {
            alert('급여 지급일은 1~31 사이로 입력해 주세요. 미입력 시 월 급여표에서 말일 등으로 표시됩니다.');
            setEditLoading(false);
            return;
          }
          payload.payrollPayDay = d;
        }
      }

      if (editingUser.role === 'TEAM_LEADER') {
        const modeRaw = editForm.teamLeaderGeneralSettlementMode;
        const valRaw = editForm.teamLeaderGeneralSettlementValue.trim().replace(/,/g, '');

        if (modeRaw === '') {
          if (valRaw !== '') {
            alert('일반 정산 방식을 선택한 뒤 금액·만분율을 입력해 주세요.');
            setEditLoading(false);
            return;
          }
          payload.teamLeaderGeneralSettlementMode = null;
          payload.teamLeaderGeneralSettlementValue = null;
        } else {
          payload.teamLeaderGeneralSettlementMode = modeRaw;
          if (valRaw === '') {
            alert(
              modeRaw === 'PERCENT_OF_GENERAL_SERVICE_BPS'
                ? '일반 서비스 금액 대비 만분율을 입력해 주세요.'
                : '건당 금액(원)을 입력해 주세요.'
            );
            setEditLoading(false);
            return;
          }
          const n = Number.parseInt(valRaw, 10);
          if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
            alert('일반 정산 값은 0 이상 정수(상한 1억)여야 합니다.');
            setEditLoading(false);
            return;
          }
          payload.teamLeaderGeneralSettlementValue = n;
        }

        const shareParsed = parseAdditionalReceiptCompanySharePercent(
          editForm.teamLeaderAdditionalReceiptCompanySharePercent,
        );
        if (!shareParsed.ok) {
          alert(shareParsed.message);
          setEditLoading(false);
          return;
        }
        payload.teamLeaderAdditionalReceiptCompanyShareBps = shareParsed.bps;
        payload.serviceZoneIds = editSzForm.serviceZoneIds;
      }

      if (editingUser.role === 'TEAM_LEADER' || editingUser.role === 'MARKETER') {
        if (editOcForm.operatingCompanyIds.length === 0) {
          alert('소속 영업 브랜드를 1개 이상 선택해 주세요.');
          setEditLoading(false);
          return;
        }
        payload.operatingCompanyIds = editOcForm.operatingCompanyIds;
        payload.primaryOperatingCompanyId = editOcForm.primaryOperatingCompanyId;
      }

      if (editingUser.role === 'MARKETER') {
        payload.marketerAdminLevel = editForm.marketerAdminLevel;
      }

      await updateUser(token, editingUser.id, payload);
      setEditingUser(null);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleAllowSelfDayOffToggle = async (item: UserItem, next: boolean) => {
    if (!token) return;
    setDayOffSwitchId(item.id);
    try {
      await updateUser(token, item.id, { allowSelfDayOffEdit: next });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '설정을 바꾸지 못했습니다.');
    } finally {
      setDayOffSwitchId(null);
    }
  };

  const handleBulkDayOffSelfEdit = async (enabled: boolean) => {
    if (!token || teamLeaders.length === 0) return;
    const msg = enabled
      ? '모든 팀장에게 본인 휴무일 등록을 허용할까요?'
      : '모든 팀장의 본인 휴무일 등록을 금지할까요? (이미 등록된 휴무는 유지되며, 추가·삭제만 막힙니다.)';
    if (!window.confirm(msg)) return;
    setBulkDayOffLoading(true);
    try {
      await bulkSetTeamLeaderAllowSelfDayOffEdit(token, enabled);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '일괄 설정에 실패했습니다.');
    } finally {
      setBulkDayOffLoading(false);
    }
  };

  const handleDelete = async (item: UserItem, label: '팀장' | '마케터' | '사무직') => {
    if (!token) return;
    const msg = `${label} "${item.name}" (${item.email}) 계정을 삭제(비활성)할까요? 이후 해당 계정으로 로그인할 수 없습니다.`;
    if (!window.confirm(msg)) return;
    setDeletingId(item.id);
    try {
      await deleteUser(token, item.id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 min-w-0 text-center">
      <div className="w-full text-left">
        <h1 className="text-xl font-semibold text-gray-800">사용자 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          탭으로 팀장·마케터·사무직을 구분해 등록·수정합니다. 「상세·수정」에서 사원증 사진을 넣을 수 있습니다. 사무직은
          정산·월급 관리용이며 업무 로그인은 하지 않습니다. 현장 팀원은{' '}
          <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2">
            팀원 등록
          </Link>
          메뉴에서 관리합니다.
        </p>
      </div>

      {apiError && (
        <div className="mx-auto w-full max-w-4xl p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요. 터미널에서{' '}
          <code className="bg-red-100 px-1 rounded">npm run dev</code> 실행)
        </div>
      )}

      <div className="min-w-0 w-full rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden text-left">
        <nav
          className="flex flex-nowrap gap-1 overflow-x-auto overscroll-x-contain px-2 pt-2 border-b border-gray-100 bg-gray-50/60 [scrollbar-width:thin]"
          role="tablist"
          aria-label="사용자 등록 구분"
        >
          {USER_REGISTER_TABS.map((id) => {
            const count =
              id === 'leader'
                ? teamLeaders.length
                : id === 'marketer'
                  ? marketers.length
                  : id === 'office'
                    ? officeStaff.length
                    : resignedUsers.length;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={userTab === id}
                onClick={() => setUserTab(id)}
                className={`shrink-0 whitespace-nowrap px-3 py-2 text-fluid-sm rounded-t-md border-b-2 transition-colors min-h-[44px] touch-manipulation ${
                  userTab === id
                    ? 'border-blue-600 font-semibold text-blue-900 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {userRegisterTabLabel(id)}
                <span className="ml-1.5 tabular-nums text-gray-500 font-normal">({count})</span>
              </button>
            );
          })}
        </nav>

        {userTab === 'leader' ? (
        <div className="min-w-0 text-left">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50/80 border-b border-gray-100 text-left">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h3 className="shrink-0 font-medium text-gray-800">팀장 ({teamLeaders.length}명)</h3>
              {!loading && teamLeaders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={bulkDayOffLoading}
                    onClick={() => void handleBulkDayOffSelfEdit(true)}
                    className="px-3 py-1.5 text-fluid-xs font-medium rounded border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    휴무 일괄 허용
                  </button>
                  <button
                    type="button"
                    disabled={bulkDayOffLoading}
                    onClick={() => void handleBulkDayOffSelfEdit(false)}
                    className="px-3 py-1.5 text-fluid-xs font-medium rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    일괄 금지
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (showForm === 'team') setShowForm(null);
                else {
                  setForm(emptyRegisterForm());
                  setOcForm(defaultUserOperatingCompanyForm(operatingCompanies));
                  setSzForm({ serviceZoneIds: [] });
                  setShowForm('team');
                }
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-light leading-none text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
              aria-label={showForm === 'team' ? '팀장 등록 닫기' : '팀장 등록 열기'}
            >
              {showForm === 'team' ? '×' : '+'}
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">로딩 중...</div>
          ) : teamLeaders.length === 0 && !apiError ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">등록된 팀장이 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-3 text-left lg:hidden">
                {teamLeaders.map((item) => {
                  const on = item.allowSelfDayOffEdit !== false;
                  return (
                    <div key={item.id} className={userMobileCardShell}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${item.name} 수정`}
                        onClick={() => openEdit(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openEdit(item);
                          }
                        }}
                        className="cursor-pointer px-3 pt-3 pb-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-left text-fluid-xs text-gray-600" title={`${item.name} · ${item.email} · ${item.phone || '연락처 없음'}`}>
                            <span className="font-semibold text-gray-900">{item.name}</span>
                            <span className="mx-1 text-gray-400">·</span>
                            <span>{item.email}</span>
                            <span className="mx-1 text-gray-400">·</span>
                            <span className="tabular-nums">{item.phone || '연락처 없음'}</span>
                          </p>
                          <div className="mt-1.5 space-y-1">
                            <OperatingCompanyBadges items={item.operatingCompanies} />
                            <ServiceZoneBadges items={item.serviceZones} />
                          </div>
                        </div>
                      </div>
                      <div
                        className="border-t border-gray-200/80 bg-gray-50/80 px-3 py-2 text-left"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-nowrap items-center justify-start gap-2 overflow-x-auto whitespace-nowrap">
                          <span className="shrink-0 text-fluid-2xs font-medium text-gray-600">휴무 등록</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label="본인 휴무일 등록 허용"
                            disabled={dayOffSwitchId === item.id}
                            onClick={() => void handleAllowSelfDayOffToggle(item, !on)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
                              on ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                on ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="shrink-0 text-fluid-xs font-medium text-blue-600 hover:underline"
                          >
                            상세·수정
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item, '팀장')}
                            className="shrink-0 text-fluid-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingId === item.id ? '처리 중…' : '삭제'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden lg:block">
                <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse text-fluid-sm min-w-[760px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">아이디</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">이름</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">브랜드</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">권역</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">연락처</th>
                        <th className="px-2 py-3 text-center font-medium text-gray-700 w-[7.5rem] whitespace-nowrap">
                          본인 휴무
                          <br />
                          <span className="font-normal text-fluid-2xs text-gray-500">등록 허용</span>
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 w-28 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamLeaders.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap">{item.email}</td>
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap">{item.name}</td>
                          <td className="px-4 py-3 text-center">
                            <OperatingCompanyBadges items={item.operatingCompanies} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ServiceZoneBadges items={item.serviceZones} />
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap tabular-nums">
                            {item.phone || '-'}
                          </td>
                          <td className="px-2 py-3 text-center whitespace-nowrap">
                            {(() => {
                              const on = item.allowSelfDayOffEdit !== false;
                              return (
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={on}
                                  disabled={dayOffSwitchId === item.id}
                                  onClick={() => void handleAllowSelfDayOffToggle(item, !on)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-wait disabled:opacity-60 ${
                                    on ? 'bg-emerald-500' : 'bg-gray-300'
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                      on ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 mr-1"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => handleDelete(item, '팀장')}
                              className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === item.id ? '처리 중…' : '삭제'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SyncHorizontalScroll>
              </div>
            </>
          )}
        </div>
        ) : null}

        {userTab === 'marketer' ? (
        <div className="min-w-0 text-left">
          <div className="flex flex-row items-center justify-between gap-2 px-4 py-3 bg-gray-50/80 border-b border-gray-100 text-left">
            <h3 className="font-medium text-gray-800">마케터 ({marketers.length}명)</h3>
            <button
              type="button"
              onClick={() => {
                if (showForm === 'marketer') setShowForm(null);
                else {
                  setForm(emptyRegisterForm());
                  setOcForm(defaultUserOperatingCompanyForm(operatingCompanies));
                  setShowForm('marketer');
                }
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-xl font-light leading-none text-white shadow-sm hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
              aria-label={showForm === 'marketer' ? '마케터 등록 닫기' : '마케터 등록 열기'}
            >
              {showForm === 'marketer' ? '×' : '+'}
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">로딩 중...</div>
          ) : marketers.length === 0 && !apiError ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">등록된 마케터가 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-3 text-left lg:hidden">
                {marketers.map((item) => (
                  <div key={item.id} className={userMobileCardShell}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.name} 수정`}
                      onClick={() => openEdit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEdit(item);
                        }
                      }}
                      className="cursor-pointer px-3 pt-3 pb-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-left text-fluid-xs text-gray-600" title={`${item.name} · ${item.email} · ${item.phone || '연락처 없음'}`}>
                          <span className="font-semibold text-gray-900">{item.name}</span>
                          {(() => {
                            const badge = marketerAdminLevelBadge(resolveMarketerAdminLevel(item));
                            return badge ? <span className="ml-1.5">{badge}</span> : null;
                          })()}
                          <span className="mx-1 text-gray-400">·</span>
                          <span>{item.email}</span>
                          <span className="mx-1 text-gray-400">·</span>
                          <span className="tabular-nums">{item.phone || '연락처 없음'}</span>
                        </p>
                        <p className="mt-1 text-left text-fluid-2xs text-gray-600 tabular-nums">
                          월급 {formatUserPayrollSalaryCell(item.payrollMonthlySalary)} · 급여일{' '}
                          {formatUserPayrollPayDayCell(item.payrollPayDay)}
                        </p>
                        <div className="mt-1.5">
                          <OperatingCompanyBadges items={item.operatingCompanies} />
                        </div>
                      </div>
                    </div>
                    <div
                      className="border-t border-gray-200/80 bg-gray-50/80 px-3 py-2.5 text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap justify-start gap-x-2 gap-y-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-fluid-xs font-medium text-blue-600 hover:underline"
                        >
                          상세·수정
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item, '마케터')}
                          className="text-fluid-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingId === item.id ? '처리 중…' : '삭제'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse text-fluid-sm min-w-[860px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">아이디</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">이름</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">관리자권한</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">브랜드</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">연락처</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">월 급여</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">급여일</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 w-28 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketers.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap">{item.email}</td>
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap">{item.name}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {(() => {
                              const badge = marketerAdminLevelBadge(resolveMarketerAdminLevel(item));
                              return badge ?? <span className="text-fluid-2xs text-gray-400">—</span>;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <OperatingCompanyBadges items={item.operatingCompanies} />
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap tabular-nums">
                            {item.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap tabular-nums text-fluid-xs">
                            {formatUserPayrollSalaryCell(item.payrollMonthlySalary)}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap tabular-nums text-fluid-xs">
                            {formatUserPayrollPayDayCell(item.payrollPayDay)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 mr-1"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => handleDelete(item, '마케터')}
                              className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === item.id ? '처리 중…' : '삭제'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SyncHorizontalScroll>
              </div>
            </>
          )}
        </div>
        ) : null}

        {userTab === 'office' ? (
        <div className="min-w-0 text-left">
          <div className="flex flex-row items-center justify-between gap-2 px-4 py-3 bg-gray-50/80 border-b border-gray-100 text-left">
            <h3 className="font-medium text-gray-800">사무직 ({officeStaff.length}명)</h3>
            <button
              type="button"
              onClick={() => {
                if (showForm === 'office') setShowForm(null);
                else {
                  setForm(emptyRegisterForm());
                  setShowForm('office');
                }
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xl font-light leading-none text-white shadow-sm hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
              aria-label={showForm === 'office' ? '사무직 등록 닫기' : '사무직 등록 열기'}
            >
              {showForm === 'office' ? '×' : '+'}
            </button>
          </div>
          {loading ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">로딩 중...</div>
          ) : officeStaff.length === 0 && !apiError ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">등록된 사무직이 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-3 text-left lg:hidden">
                {officeStaff.map((item) => (
                  <div key={item.id} className={userMobileCardShell}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.name} 수정`}
                      onClick={() => openEdit(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEdit(item);
                        }
                      }}
                      className="cursor-pointer px-3 pt-3 pb-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-left text-fluid-xs text-gray-600" title={`${item.name} · ${item.email} · ${item.phone || '연락처 없음'}`}>
                          <span className="font-semibold text-gray-900">{item.name}</span>
                          <span className="mx-1 text-gray-400">·</span>
                          <span>{item.email}</span>
                          <span className="mx-1 text-gray-400">·</span>
                          <span className="tabular-nums">{item.phone || '연락처 없음'}</span>
                        </p>
                        <p className="mt-1 text-left text-fluid-2xs text-gray-600 tabular-nums">
                          월급 {formatUserPayrollSalaryCell(item.payrollMonthlySalary)} · 급여일{' '}
                          {formatUserPayrollPayDayCell(item.payrollPayDay)}
                        </p>
                      </div>
                    </div>
                    <div
                      className="border-t border-gray-200/80 bg-gray-50/80 px-3 py-2.5 text-left"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap justify-start gap-x-2 gap-y-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="text-fluid-xs font-medium text-blue-600 hover:underline"
                        >
                          상세·수정
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item, '사무직')}
                          className="text-fluid-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingId === item.id ? '처리 중…' : '삭제'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse text-fluid-sm min-w-[760px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">아이디</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">이름</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">연락처</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">월 급여</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">급여일</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 w-28 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officeStaff.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap">{item.email}</td>
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap">{item.name}</td>
                          <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap tabular-nums">
                            {item.phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-800 whitespace-nowrap tabular-nums text-fluid-xs">
                            {formatUserPayrollSalaryCell(item.payrollMonthlySalary)}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700 whitespace-nowrap tabular-nums text-fluid-xs">
                            {formatUserPayrollPayDayCell(item.payrollPayDay)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 mr-1"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => handleDelete(item, '사무직')}
                              className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === item.id ? '처리 중…' : '삭제'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SyncHorizontalScroll>
              </div>
            </>
          )}
        </div>
        ) : null}

        {userTab === 'resigned' ? (
        <div className="min-w-0 text-left">
          <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100">
            <h3 className="font-medium text-gray-800">퇴사자 ({resignedUsers.length}명)</h3>
            <p className="mt-1 text-fluid-xs text-gray-500">
              퇴사일(해당일 미포함)이 지난 팀장·마케터·사무직입니다. 과거 스케줄·접수 기록은 그대로 유지됩니다.
              복직 시 수정에서 퇴사일을 비우세요.
            </p>
          </div>
          {loading ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">로딩 중...</div>
          ) : resignedUsers.length === 0 && !apiError ? (
            <div className="p-8 text-left text-gray-500 lg:text-center">퇴사 처리된 사용자가 없습니다.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-3 text-left lg:hidden">
                {resignedUsers.map((item) => (
                  <div key={item.id} className={userMobileCardShell}>
                    <button
                      type="button"
                      className="w-full px-3 py-3 text-left"
                      onClick={() => openEdit(item)}
                    >
                      <p className="text-fluid-xs text-gray-500">{userRoleLabel(item.role as UserRole)}</p>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-fluid-xs text-gray-600 mt-0.5">{item.email}</p>
                      <p className="text-fluid-xs text-gray-500 mt-1 tabular-nums">
                        퇴사일 {item.resignationDate ?? '—'}
                        {item.hireDate ? ` · 입사 ${item.hireDate}` : ''}
                      </p>
                    </button>
                  </div>
                ))}
              </div>
              <div className="hidden lg:block">
                <SyncHorizontalScroll>
                  <table className="w-full min-w-[640px] table-fixed border-collapse text-fluid-sm">
                    <colgroup>
                      <col className="w-[72px]" />
                      <col className="w-[100px]" />
                      <col />
                      <col className="w-[110px]" />
                      <col className="w-[110px]" />
                      <col className="w-[88px]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="px-2 py-2 text-center font-medium">구분</th>
                        <th className="px-2 py-2 text-center font-medium">이름</th>
                        <th className="px-2 py-2 text-center font-medium">아이디</th>
                        <th className="px-2 py-2 text-center font-medium">입사일</th>
                        <th className="px-2 py-2 text-center font-medium">퇴사일</th>
                        <th className="px-2 py-2 text-center font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resignedUsers.map((item) => (
                        <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-2 py-2 text-center text-gray-600">
                            {userRoleLabel(item.role as UserRole)}
                          </td>
                          <td className="px-2 py-2 text-center font-medium text-gray-900 truncate" title={item.name}>
                            {item.name}
                          </td>
                          <td className="px-2 py-2 text-center text-gray-600 truncate" title={item.email}>
                            {item.email}
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums text-gray-600">
                            {item.hireDate ?? '—'}
                          </td>
                          <td className="px-2 py-2 text-center tabular-nums text-gray-800">
                            {item.resignationDate ?? '—'}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                            >
                              수정
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SyncHorizontalScroll>
              </div>
            </>
          )}
        </div>
        ) : null}
      </div>

      {(showForm === 'team' || showForm === 'marketer' || showForm === 'office') &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] overflow-y-auto overscroll-y-contain bg-black/40 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              showForm === 'team'
                ? 'register-team-title'
                : showForm === 'office'
                  ? 'register-office-title'
                  : 'register-marketer-title'
            }
            onClick={() => {
              if (!submitLoading) setShowForm(null);
            }}
          >
            <div
              className="relative mx-auto mt-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ModalCloseButton
                onClick={() => !submitLoading && setShowForm(null)}
                disabled={submitLoading}
                aria-label="등록 창 닫기"
              />
              <h2
                id={
                  showForm === 'team'
                    ? 'register-team-title'
                    : showForm === 'office'
                      ? 'register-office-title'
                      : 'register-marketer-title'
                }
                className="text-lg font-semibold text-gray-800 mb-1 pr-10"
              >
                {showForm === 'team' ? '팀장 등록' : showForm === 'office' ? '사무직 등록' : '마케터 등록'}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                {showForm === 'team'
                  ? '아이디·비밀번호·이름은 필수입니다. 일반 정산과 추가결재 회사 몫은 접수 정산에 반영됩니다. 아래 「참고」 블록의 월 고정 급여는 선택 사항입니다.'
                  : showForm === 'office'
                    ? '아이디·비밀번호·이름은 필수입니다. 사무직은 정산·월급 지출 관리용이며 업무 로그인은 하지 않습니다. 월 급여·급여일은 월 급여표 「사무직」 탭에 반영됩니다.'
                    : '아이디·비밀번호·이름은 필수입니다. 월 급여·급여일은 선택 입력하며, 월 급여표 「마케터」 탭에 반영됩니다.'}
              </p>
              <form
                onSubmit={(e) =>
                  handleSubmit(
                    e,
                    showForm === 'team'
                      ? 'TEAM_LEADER'
                      : showForm === 'office'
                        ? 'OFFICE_STAFF'
                        : 'MARKETER',
                  )
                }
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left"
              >
                <div>
                  <label className="block text-sm text-gray-600 mb-1">아이디 (로그인용)</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder={
                      showForm === 'team' ? 'team1' : showForm === 'office' ? 'office1' : 'marketer1'
                    }
                    required
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">비밀번호</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">이름</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">연락처 (선택)</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="010-0000-0000"
                  />
                </div>
                {showForm === 'team' || showForm === 'marketer' ? (
                  <div className="sm:col-span-2">
                    <UserOperatingCompanyFields
                      companies={operatingCompanies}
                      value={ocForm}
                      onChange={setOcForm}
                    />
                  </div>
                ) : null}
                {showForm === 'team' ? (
                  <div className="sm:col-span-2">
                    <UserServiceZoneFields zones={serviceZones} value={szForm} onChange={setSzForm} />
                  </div>
                ) : null}
                {showForm === 'team' ? (
                  <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                    <p className="text-fluid-xs font-medium text-gray-800">일반 정산 · 추가결재</p>
                    <p className="text-fluid-2xs text-gray-600 leading-snug">
                      일반 결재는 건당 원 또는 일반 서비스 금액 대비 만분율로 정합니다. 추가결재는{' '}
                      <strong className="font-medium text-gray-800">회사 몫을 퍼센트 숫자(0~100)</strong>로 넣습니다(예: 50 → 회사
                      50%, 나머지는 팀장). 비우면 정산 화면 기본 비율을 씁니다.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">일반 정산 방식</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                          value={form.teamLeaderGeneralSettlementMode}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              teamLeaderGeneralSettlementMode: e.target
                                .value as RegisterFormState['teamLeaderGeneralSettlementMode'],
                            }))
                          }
                        >
                          <option value="">미설정</option>
                          <option value="FIXED_PER_JOB_WON">건당 고정(원)</option>
                          <option value="PERCENT_OF_GENERAL_SERVICE_BPS">일반 서비스 금액 대비 만분율</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">
                          {form.teamLeaderGeneralSettlementMode === 'PERCENT_OF_GENERAL_SERVICE_BPS'
                            ? '만분율 (예: 1500 = 15%)'
                            : form.teamLeaderGeneralSettlementMode === 'FIXED_PER_JOB_WON'
                              ? '건당 금액 (원)'
                              : '금액 또는 만분율'}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={form.teamLeaderGeneralSettlementMode === ''}
                          value={form.teamLeaderGeneralSettlementValue}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, teamLeaderGeneralSettlementValue: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums disabled:bg-gray-100 disabled:text-gray-500"
                          placeholder={
                            form.teamLeaderGeneralSettlementMode === 'PERCENT_OF_GENERAL_SERVICE_BPS'
                              ? '예: 1500'
                              : form.teamLeaderGeneralSettlementMode === 'FIXED_PER_JOB_WON'
                                ? '예: 80000'
                                : '방식을 먼저 선택하세요'
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">
                          추가결재 회사 몫 (%){' '}
                          <span className="font-normal text-gray-400">선택 · 비우면 미설정</span>
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.teamLeaderAdditionalReceiptCompanySharePercent}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              teamLeaderAdditionalReceiptCompanySharePercent: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                          placeholder="예: 50 (= 회사 50%)"
                          aria-describedby="register-teamleader-add-share-hint"
                        />
                        <p id="register-teamleader-add-share-hint" className="mt-1 text-fluid-2xs text-gray-500">
                          0~100 숫자만 입력합니다. 소수 가능합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                  {showForm === 'team' ? (
                    <details className="group space-y-3">
                      <summary className="cursor-pointer select-none text-fluid-xs font-medium text-gray-800 list-none [&::-webkit-details-marker]:hidden">
                        <span className="underline decoration-gray-300 underline-offset-2">
                          참고 · 월 급여표용 고정 급여·급여일 (선택)
                        </span>
                      </summary>
                      <p className="text-fluid-2xs text-gray-500 leading-snug">
                        실제 지급은 급여표에서 수시 등록할 수 있습니다. 여기 값은 참고용이며 비워도 됩니다.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">월 고정 급여 (원)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={form.payrollMonthlySalary}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, payrollMonthlySalary: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums bg-white"
                            placeholder="예: 3500000 · 비우면 미설정"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">급여 지급일 (1–31)</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            step={1}
                            value={form.payrollPayDay}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, payrollPayDay: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums bg-white"
                            placeholder="비우면 말일"
                          />
                        </div>
                      </div>
                    </details>
                  ) : showForm === 'marketer' ? (
                    <>
                      <p className="text-fluid-xs font-medium text-gray-800">마케터 · 월 급여표</p>
                      <p className="text-fluid-2xs text-gray-500 leading-snug">
                        월 고정 급여와 매월 지급일을 넣으면 관리자 월 급여표 「마케터」 탭에 금액·지급일 열로 표시됩니다.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">월 고정 급여 (원)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={form.payrollMonthlySalary}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, payrollMonthlySalary: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                            placeholder="예: 3500000 · 비우면 미설정"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">급여 지급일 (1–31)</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            step={1}
                            value={form.payrollPayDay}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, payrollPayDay: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                            placeholder="비우면 말일"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-fluid-xs font-medium text-gray-800">사무직 · 월 급여표</p>
                      <p className="text-fluid-2xs text-gray-500 leading-snug">
                        월 고정 급여와 매월 지급일을 넣으면 관리자 월 급여표 「사무직」 탭과 정산 인건비에 반영됩니다.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">월 고정 급여 (원)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={form.payrollMonthlySalary}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, payrollMonthlySalary: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                            placeholder="예: 2800000 · 비우면 미설정"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">급여 지급일 (1–31)</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            step={1}
                            value={form.payrollPayDay}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, payrollPayDay: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                            placeholder="비우면 말일"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="sm:col-span-2 flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className={`px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 ${
                      showForm === 'team'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : showForm === 'office'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {submitLoading ? '등록 중…' : '등록'}
                  </button>
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={() => setShowForm(null)}
                    className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {editingUser &&
        createPortal(
          <div
            className="fixed inset-0 z-[201] overflow-y-auto overscroll-y-contain bg-black/40 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-edit-title"
          >
            <div className="relative mx-auto mt-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <ModalCloseButton onClick={() => setEditingUser(null)} />
              <h2 id="user-edit-title" className="text-lg font-semibold text-gray-800 mb-1 pr-10">
                사용자 수정
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                역할: {userRoleLabel(editingUser.role)} · 새 비밀번호는 변경할 때만 입력
              </p>
              <form id="admin-user-edit-form" onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">아이디 (로그인용)</label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    required
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">이름</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">연락처 (선택)</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">새 비밀번호 (선택)</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="비우면 기존 비밀번호 유지"
                    autoComplete="new-password"
                  />
                </div>
                {editingUser.role === 'TEAM_LEADER' || editingUser.role === 'MARKETER' ? (
                  <UserOperatingCompanyFields
                    companies={operatingCompanies}
                    value={editOcForm}
                    onChange={setEditOcForm}
                  />
                ) : null}
                {editingUser.role === 'TEAM_LEADER' ? (
                  <UserServiceZoneFields
                    zones={serviceZones}
                    value={editSzForm}
                    onChange={setEditSzForm}
                  />
                ) : null}
                {editingUser.role === 'TEAM_LEADER' && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-3">
                    <p className="text-fluid-xs font-medium text-gray-800">일반 정산 · 추가결재</p>
                    <p className="text-fluid-2xs text-gray-600 leading-snug">
                      접수의 일반 결재·추가결재 정산에 사용됩니다. 추가결재 회사 몫은{' '}
                      <strong className="font-medium text-gray-800">0~100 퍼센트 숫자</strong>로 넣습니다. 비우면 정산 화면 기본값을
                      따릅니다.
                    </p>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">일반 정산 방식</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                        value={editForm.teamLeaderGeneralSettlementMode}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            teamLeaderGeneralSettlementMode: e.target
                              .value as EditFormState['teamLeaderGeneralSettlementMode'],
                          }))
                        }
                      >
                        <option value="">미설정</option>
                        <option value="FIXED_PER_JOB_WON">건당 고정(원)</option>
                        <option value="PERCENT_OF_GENERAL_SERVICE_BPS">일반 서비스 금액 대비 만분율</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        {editForm.teamLeaderGeneralSettlementMode === 'PERCENT_OF_GENERAL_SERVICE_BPS'
                          ? '만분율 (예: 1500 = 15%)'
                          : editForm.teamLeaderGeneralSettlementMode === 'FIXED_PER_JOB_WON'
                            ? '건당 금액 (원)'
                            : '금액 또는 만분율'}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={editForm.teamLeaderGeneralSettlementMode === ''}
                        value={editForm.teamLeaderGeneralSettlementValue}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, teamLeaderGeneralSettlementValue: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums disabled:bg-gray-100 disabled:text-gray-500"
                        placeholder={
                          editForm.teamLeaderGeneralSettlementMode === 'PERCENT_OF_GENERAL_SERVICE_BPS'
                            ? '예: 1500'
                            : editForm.teamLeaderGeneralSettlementMode === 'FIXED_PER_JOB_WON'
                              ? '예: 80000'
                              : '방식을 먼저 선택하세요'
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        추가결재 회사 몫 (%){' '}
                        <span className="font-normal text-gray-400">선택 · 비우면 미설정</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editForm.teamLeaderAdditionalReceiptCompanySharePercent}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            teamLeaderAdditionalReceiptCompanySharePercent: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                        placeholder="예: 50 (= 회사 50%)"
                        aria-describedby="edit-teamleader-add-share-hint"
                      />
                      <p id="edit-teamleader-add-share-hint" className="mt-1 text-fluid-2xs text-gray-500">
                        0~100 숫자만 입력합니다. 소수 가능합니다.
                      </p>
                    </div>
                  </div>
                )}
                {editingUser.role === 'TEAM_LEADER' && (
                  <details className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                    <summary className="cursor-pointer select-none text-fluid-xs font-medium text-gray-800 list-none [&::-webkit-details-marker]:hidden">
                      <span className="underline decoration-gray-300 underline-offset-2">
                        참고 · 월 급여표용 고정 급여·급여일
                      </span>
                    </summary>
                    <p className="text-fluid-2xs text-gray-500 leading-snug">
                      현장 팀원 일당은 팀원 등록에서 다룹니다. 여기는 월 급여표 열용 참고값이며 비워도 됩니다.
                    </p>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">월 고정 급여 (원)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editForm.payrollMonthlySalary}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, payrollMonthlySalary: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums bg-white"
                        placeholder="예: 3500000 · 비우면 미설정"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">급여 지급일 (1–31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        step={1}
                        value={editForm.payrollPayDay}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, payrollPayDay: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums bg-white"
                        placeholder="비우면 월 급여표에서 말일 규칙"
                      />
                      <p className="text-fluid-2xs text-gray-500 mt-1">
                        현장 팀원의 일당은{' '}
                        <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2">
                          팀원 등록
                        </Link>
                        에서 설정합니다.
                      </p>
                    </div>
                  </details>
                )}
                {(editingUser.role === 'MARKETER' || editingUser.role === 'OFFICE_STAFF') && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                    {editingUser.role === 'MARKETER' ? (
                      <fieldset className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                        <legend className="px-1 text-fluid-sm font-medium text-gray-900">
                          관리자 권한
                        </legend>
                        <p className="text-fluid-2xs text-gray-500 leading-snug">
                          마케터별로 운영 권한 범위를 선택합니다. 설정 변경은 ADMIN 계정만 가능합니다.
                        </p>
                        {(
                          [
                            {
                              value: 'NONE' as const,
                              title: MARKETER_ADMIN_LEVEL_LABEL.NONE,
                              hint: '일반 마케터 — 기본 접수·발주 업무만',
                            },
                            {
                              value: 'LIMITED' as const,
                              title: MARKETER_ADMIN_LEVEL_LABEL.LIMITED,
                              hint: '배정·삭제·접수 고급 수정 등 — 관리자 전용 메뉴(사용자 등록·정산 설정 등)는 제외',
                            },
                            {
                              value: 'FULL' as const,
                              title: MARKETER_ADMIN_LEVEL_LABEL.FULL,
                              hint: '관리자와 동일 업무 메뉴·API — ADMIN 전용·업체 소유자 기능은 제외',
                            },
                          ] as const
                        ).map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 ${
                              editForm.marketerAdminLevel === opt.value
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="marketerAdminLevel"
                              className="mt-0.5"
                              checked={editForm.marketerAdminLevel === opt.value}
                              onChange={() =>
                                setEditForm((p) => ({ ...p, marketerAdminLevel: opt.value }))
                              }
                            />
                            <span className="min-w-0 text-left">
                              <span className="block text-fluid-sm font-medium text-gray-900">
                                {opt.title}
                              </span>
                              <span className="mt-1 block text-fluid-2xs text-gray-500 leading-snug">
                                {opt.hint}
                              </span>
                            </span>
                          </label>
                        ))}
                        {editingUser.id ? (
                          <Link
                            to={`/admin/team-leaders/staff-access?userId=${encodeURIComponent(editingUser.id)}`}
                            className="inline-block text-fluid-2xs text-sky-700 hover:text-sky-900 underline underline-offset-2"
                          >
                            항목별 상세 권한 설정 →
                          </Link>
                        ) : null}
                      </fieldset>
                    ) : null}
                    <div>
                      <p className="text-fluid-xs font-medium text-gray-800">
                        {editingUser.role === 'OFFICE_STAFF' ? '사무직' : '직원(마케터)'} · 월 급여표
                      </p>
                      <p className="text-fluid-2xs text-gray-500 mt-0.5 leading-snug">
                        {editingUser.role === 'OFFICE_STAFF'
                          ? '정산·월급 지출 관리용입니다. 월 고정 급여와 급여일을 넣으면 월 급여표 「사무직」 탭에 표시됩니다.'
                          : '마케터는 팀장과 계정·급여 조건이 다릅니다. 월 고정 급여만 표에 넣으며, 근무 형태별 세부는 금액에 반영해 주세요.'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">월 고정 급여 (원)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editForm.payrollMonthlySalary}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, payrollMonthlySalary: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                        placeholder="예: 3500000 · 비우면 미설정"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">급여 지급일 (1–31)</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        step={1}
                        value={editForm.payrollPayDay}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, payrollPayDay: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                        placeholder="비우면 월 급여표에서 말일 규칙"
                      />
                      <p className="text-fluid-2xs text-gray-500 mt-1">
                        {editingUser.role === 'OFFICE_STAFF'
                          ? '사무직 월 급여표 열과 동일하게 적용됩니다.'
                          : '마케터 월 급여표 열과 동일하게 적용됩니다.'}
                      </p>
                    </div>
                  </div>
                )}
                {isTenantOwner && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">입사일 (포함)</label>
                      <input
                        type="date"
                        value={editForm.hireDate}
                        onChange={(e) => setEditForm((p) => ({ ...p, hireDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <p className="text-fluid-2xs text-gray-500 mt-1">해당일부터 스케줄·배정·TO에 포함됩니다. 비우면 제한 없음.</p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">퇴사일 (해당일 미포함)</label>
                      <input
                        type="date"
                        value={editForm.resignationDate}
                        onChange={(e) => setEditForm((p) => ({ ...p, resignationDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <p className="text-fluid-2xs text-gray-500 mt-1">해당일부터 드롭다운·배정에서 제외됩니다. 비우면 재직 중.</p>
                    </div>
                  </>
                )}
              </form>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2 mt-4">
                <p className="text-sm font-medium text-gray-800">사원증 사진</p>
                <p className="text-fluid-2xs text-gray-500 leading-snug">
                  모바일에서 본인 아이디로 로그인해 고객에게 보여 주며 인증할 때 사용할 수 있도록 관리자가 등록합니다.
                  이미지는 Cloudinary에 저장됩니다.{' '}
                  <span className="text-amber-800">
                    로컬에서 안 되면 서버 <code className="text-[11px]">server/.env</code>에 CLOUDINARY 설정을
                    확인하세요.
                  </span>
                </p>
                {editingUser.staffIdCardUrl ? (
                  <img
                    src={editingUser.staffIdCardUrl}
                    alt=""
                    className="max-h-52 w-full rounded border border-gray-200 bg-white object-contain"
                  />
                ) : (
                  <p className="text-fluid-xs text-gray-500">등록된 사진이 없습니다.</p>
                )}
                <input
                  ref={staffIdCardInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  disabled={staffIdCardBusy || editLoading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    const inputEl = e.target;
                    void (async () => {
                      if (!f) return;
                      if (!token || !editingUser) {
                        alert('로그인이 필요합니다.');
                        return;
                      }
                      setStaffIdCardBusy(true);
                      try {
                        const { staffIdCardUrl } = await uploadUserStaffIdCard(token, editingUser.id, f);
                        setEditingUser({ ...editingUser, staffIdCardUrl });
                        await refresh();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '업로드에 실패했습니다.');
                      } finally {
                        setStaffIdCardBusy(false);
                        inputEl.value = '';
                      }
                    })();
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={staffIdCardBusy || editLoading}
                    className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => staffIdCardInputRef.current?.click()}
                  >
                    {staffIdCardBusy ? '처리 중…' : editingUser.staffIdCardUrl ? '사진 교체' : '사진 올리기'}
                  </button>
                  {editingUser.staffIdCardUrl ? (
                    <button
                      type="button"
                      disabled={staffIdCardBusy || editLoading}
                      className="rounded border border-red-200 bg-white px-3 py-1.5 text-fluid-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      onClick={() => {
                        if (!token || !editingUser) return;
                        if (!window.confirm('사원증 사진을 삭제할까요?')) return;
                        void (async () => {
                          setStaffIdCardBusy(true);
                          try {
                            await deleteUserStaffIdCard(token, editingUser.id);
                            setEditingUser({ ...editingUser, staffIdCardUrl: null });
                            await refresh();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
                          } finally {
                            setStaffIdCardBusy(false);
                          }
                        })();
                      }}
                    >
                      사진 삭제
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  form="admin-user-edit-form"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? '저장 중…' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
