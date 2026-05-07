import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  bulkSetTeamLeaderAllowSelfDayOffEdit,
  uploadUserStaffIdCard,
  deleteUserStaffIdCard,
  type UserItem,
} from '../../api/users';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';

type UserRole = 'TEAM_LEADER' | 'MARKETER';

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

export function AdminTeamLeadersPage() {
  const token = getToken();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [marketers, setMarketers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<'team' | 'marketer' | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    phone: '',
    password: '',
    hireDate: '',
    resignationDate: '',
    payrollMonthlySalary: '',
    payrollPayDay: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [staffIdCardBusy, setStaffIdCardBusy] = useState(false);
  const staffIdCardInputRef = useRef<HTMLInputElement>(null);
  const [dayOffSwitchId, setDayOffSwitchId] = useState<string | null>(null);
  const [bulkDayOffLoading, setBulkDayOffLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    payrollMonthlySalary: '',
    payrollPayDay: '',
  });

  const refresh = (): Promise<void> => {
    if (!token) return Promise.resolve();
    setApiError(null);
    return Promise.all([
      getUsers(token, 'TEAM_LEADER', { scope: 'management' }),
      getUsers(token, 'MARKETER', { scope: 'management' }),
    ])
      .then(([teamRes, marketerRes]) => {
        setTeamLeaders(teamRes);
        setMarketers(marketerRes);
        setApiError(null);
      })
      .catch((err) => {
        setTeamLeaders([]);
        setMarketers([]);
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((u: { isSuperAdmin?: boolean }) => {
        setIsSuperAdmin(Boolean(u.isSuperAdmin));
      })
      .catch(() => {
        setIsSuperAdmin(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token]);

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
      } = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        role,
      };

      if (role === 'TEAM_LEADER' || role === 'MARKETER') {
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

      await createUser(token, payload);
      setForm({ email: '', password: '', name: '', phone: '', payrollMonthlySalary: '', payrollPayDay: '' });
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
      payrollMonthlySalary:
        item.payrollMonthlySalary != null ? String(item.payrollMonthlySalary) : '',
      payrollPayDay: item.payrollPayDay != null ? String(item.payrollPayDay) : '',
    });
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
      } = {
        email: editForm.email.trim().toLowerCase(),
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      if (isSuperAdmin) {
        payload.hireDate = editForm.hireDate.trim() || null;
        payload.resignationDate = editForm.resignationDate.trim() || null;
      }
      if (editingUser.role === 'TEAM_LEADER' || editingUser.role === 'MARKETER') {
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

  const handleDelete = async (item: UserItem, label: '팀장' | '마케터') => {
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
          팀장·마케터는 아래 목록에서 「상세·수정」으로 사원증 사진을 등록할 수 있습니다. (현장 팀원은{' '}
          <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2">
            팀원 등록
          </Link>
          )
        </p>
      </div>

      {apiError && (
        <div className="mx-auto w-full max-w-4xl p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요. 터미널에서{' '}
          <code className="bg-red-100 px-1 rounded">npm run dev</code> 실행)
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 min-w-0 w-full">
        <div className="min-w-0 bg-white border border-gray-200 rounded-lg text-left">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-left">
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
                  setForm({ email: '', password: '', name: '', phone: '', payrollMonthlySalary: '', payrollPayDay: '' });
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
                  <table className="w-full border-collapse text-fluid-sm min-w-[680px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">아이디</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-700 whitespace-nowrap">이름</th>
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

        <div className="min-w-0 bg-white border border-gray-200 rounded-lg text-left">
          <div className="flex flex-row items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-left">
            <h3 className="font-medium text-gray-800">마케터 ({marketers.length}명)</h3>
            <button
              type="button"
              onClick={() => {
                if (showForm === 'marketer') setShowForm(null);
                else {
                  setForm({ email: '', password: '', name: '', phone: '', payrollMonthlySalary: '', payrollPayDay: '' });
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
                      {marketers.map((item) => (
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
      </div>

      {(showForm === 'team' || showForm === 'marketer') &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] overflow-y-auto overscroll-y-contain bg-black/40 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby={showForm === 'team' ? 'register-team-title' : 'register-marketer-title'}
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
                id={showForm === 'team' ? 'register-team-title' : 'register-marketer-title'}
                className="text-lg font-semibold text-gray-800 mb-1 pr-10"
              >
                {showForm === 'team' ? '팀장 등록' : '마케터 등록'}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                아이디·비밀번호·이름은 필수입니다. 월 급여·급여일은 마케터·팀장 모두 선택 입력하며, 월 급여표에 반영됩니다.
              </p>
              <form
                onSubmit={(e) => handleSubmit(e, showForm === 'team' ? 'TEAM_LEADER' : 'MARKETER')}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left"
              >
                <div>
                  <label className="block text-sm text-gray-600 mb-1">아이디 (로그인용)</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder={showForm === 'team' ? 'team1' : 'marketer1'}
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
                <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                  <p className="text-fluid-xs font-medium text-gray-800">
                    {showForm === 'marketer' ? '마케터 · 월 급여표' : '팀장 · 참고 월급(수시 지급과 별개)'}
                  </p>
                  <p className="text-fluid-2xs text-gray-500 leading-snug">
                    {showForm === 'marketer'
                      ? '월 고정 급여와 매월 지급일을 넣으면 관리자 월 급여표 「마케터」 탭에 금액·지급일 열로 표시됩니다.'
                      : '팀장 실제 지급은 급여표에서 수시 등록합니다. 여기 값은 참고·비고용이며, 비워도 됩니다.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">월 고정 급여 (원)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.payrollMonthlySalary}
                        onChange={(e) => setForm((p) => ({ ...p, payrollMonthlySalary: e.target.value }))}
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
                        onChange={(e) => setForm((p) => ({ ...p, payrollPayDay: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm tabular-nums"
                        placeholder="비우면 말일"
                      />
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2 flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className={`px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 ${
                      showForm === 'team'
                        ? 'bg-blue-600 hover:bg-blue-700'
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
                역할: {editingUser.role === 'MARKETER' ? '마케터' : '팀장'} · 새 비밀번호는 변경할 때만 입력
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
                {(editingUser.role === 'TEAM_LEADER' || editingUser.role === 'MARKETER') && (
                  <>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                      <div>
                        <p className="text-fluid-xs font-medium text-gray-800">
                          {editingUser.role === 'TEAM_LEADER'
                            ? '팀장 · 월 급여표(현장 일당·근무일 산정과 무관)'
                            : '직원(마케터) · 월 급여표'}
                        </p>
                        <p className="text-fluid-2xs text-gray-500 mt-0.5 leading-snug">
                          {editingUser.role === 'TEAM_LEADER'
                            ? '현장 팀원처럼 근무일×일당으로 계산하지 않고, 여기 입력한 월 고정 금액만 월 급여표에 반영됩니다.'
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
                          {editingUser.role === 'MARKETER' ? (
                            <>마케터 월 급여표 열과 동일하게 적용됩니다.</>
                          ) : (
                            <>
                              현장 팀원의 일당은{' '}
                              <Link to="/admin/team-leaders/team-members" className="text-blue-700 underline underline-offset-2">
                                팀원 등록
                              </Link>
                              에서 설정합니다.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {isSuperAdmin && (
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
