import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { MarketerAdminLevel } from '@shared/marketerAdminLevel';
import {
  MARKETER_ADMIN_LEVEL_LABEL,
  MARKETER_ADMIN_LEVEL_VALUES,
} from '@shared/marketerAdminLevel';
import {
  buildMarketerPresetPermissions,
  MARKETER_ADMIN_LOCKED_PERMISSION_IDS,
  permissionsMatchPreset,
  type MarketerPermissionGroup,
  type MarketerPermissionId,
  type MarketerPermissionMap,
} from '@shared/marketerPermissions';
import {
  getMarketerPermissionsCatalog,
  getMarketerPermissionsUser,
  listMarketerPermissionsUsers,
  saveMarketerPermissionsUser,
  type MarketerPermissionsUserResponse,
} from '../../api/marketerPermissions';
import { getToken } from '../../stores/auth';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';

function levelHint(level: MarketerAdminLevel): string {
  if (level === 'NONE') return '일반 마케터 — 기본 접수·발주 업무';
  if (level === 'LIMITED') return '배정·삭제·접수 고급 수정 등 운영 권한';
  return '관리자와 동일한 업무 메뉴(권한 설정·소유자 전용 제외)';
}

export function AdminStaffAccessSettingsPage() {
  const token = getToken();
  const { features } = useTenantCapabilities();
  const [searchParams, setSearchParams] = useSearchParams();

  const [catalog, setCatalog] = useState<MarketerPermissionGroup[]>([]);
  const [users, setUsers] = useState<MarketerPermissionsUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedUserId = searchParams.get('userId') ?? '';
  const [level, setLevel] = useState<MarketerAdminLevel>('NONE');
  const [permissions, setPermissions] = useState<MarketerPermissionMap>(() =>
    buildMarketerPresetPermissions('NONE'),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const selectedUser = useMemo(
    () => users.find((u) => u.userId === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const isModifiedFromPreset = useMemo(
    () => !permissionsMatchPreset(permissions, level),
    [permissions, level],
  );

  const featureEnabled = useCallback(
    (moduleId?: string) => {
      if (!moduleId) return true;
      return (features ?? []).includes(moduleId);
    },
    [features],
  );

  const applyUserState = useCallback((u: MarketerPermissionsUserResponse) => {
    setLevel(u.marketerAdminLevel);
    setPermissions({ ...u.permissions });
    setDirty(false);
    setSaveOk(false);
    setSaveError(null);
  }, []);

  const loadInitial = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [cat, list] = await Promise.all([
        getMarketerPermissionsCatalog(token),
        listMarketerPermissionsUsers(token),
      ]);
      setCatalog(cat.groups);
      setUsers(list.items);
      const initialOpen: Record<string, boolean> = {};
      for (const g of cat.groups) initialOpen[g.id] = true;
      setOpenGroups(initialOpen);

      const qUser = searchParams.get('userId');
      const pick = qUser ? list.items.find((u) => u.userId === qUser) : list.items[0];
      if (pick) {
        applyUserState(pick);
        if (!qUser) {
          setSearchParams({ userId: pick.userId }, { replace: true });
        }
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, searchParams, applyUserState, setSearchParams]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const selectUser = async (userId: string) => {
    if (!token) return;
    if (dirty && !window.confirm('저장하지 않은 변경 내용이 있습니다. 다른 마케터를 선택할까요?')) {
      return;
    }
    setSearchParams({ userId });
    const cached = users.find((u) => u.userId === userId);
    if (cached) {
      applyUserState(cached);
      return;
    }
    try {
      const u = await getMarketerPermissionsUser(token, userId);
      applyUserState(u);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '마케터 정보를 불러올 수 없습니다.');
    }
  };

  const applyPresetLevel = (next: MarketerAdminLevel) => {
    if (dirty && !window.confirm('프리셋을 바꾸면 현재 조정 내용이 초기화됩니다. 계속할까요?')) {
      return;
    }
    setLevel(next);
    setPermissions(buildMarketerPresetPermissions(next));
    setDirty(true);
    setSaveOk(false);
  };

  const resetToPreset = () => {
    setPermissions(buildMarketerPresetPermissions(level));
    setDirty(true);
    setSaveOk(false);
  };

  const togglePermission = (id: MarketerPermissionId, checked: boolean) => {
    if (MARKETER_ADMIN_LOCKED_PERMISSION_IDS.includes(id)) return;
    setPermissions((prev) => ({ ...prev, [id]: checked }));
    setDirty(true);
    setSaveOk(false);
  };

  const handleSave = async () => {
    if (!token || !selectedUserId) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const saved = await saveMarketerPermissionsUser(token, selectedUserId, {
        marketerAdminLevel: level,
        permissions,
      });
      setUsers((prev) => prev.map((u) => (u.userId === saved.userId ? saved : u)));
      applyUserState(saved);
      setSaveOk(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-w-0 w-full max-w-4xl p-8 text-center text-fluid-sm text-gray-500">
        불러오는 중…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-w-0 w-full max-w-4xl space-y-4">
        <p className="text-sm text-red-600">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadInitial()}
          className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">직원 권한 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          마케터별로 기본 단계(없음·일부·전체)를 고른 뒤, 필요한 권한만 추가·제거할 수 있습니다.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="staff-access-user" className="block text-sm font-medium text-gray-700 mb-1">
              마케터 선택
            </label>
            <select
              id="staff-access-user"
              value={selectedUserId}
              onChange={(e) => void selectUser(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {users.length === 0 ? (
                <option value="">등록된 마케터 없음</option>
              ) : (
                users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name} ({u.email}){u.isActive ? '' : ' · 퇴사'}
                  </option>
                ))
              )}
            </select>
          </div>
          <Link
            to="/admin/team-leaders?tab=marketer"
            className="shrink-0 text-sm text-sky-700 hover:text-sky-900 underline-offset-2 hover:underline"
          >
            사용자 등록 →
          </Link>
        </div>

        {selectedUser ? (
          <>
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3 space-y-3">
              <p className="text-sm font-medium text-slate-800">기본 단계</p>
              <div className="flex flex-col gap-2">
                {MARKETER_ADMIN_LEVEL_VALUES.map((lv) => (
                  <label
                    key={lv}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                      level === lv ? 'border-slate-800 bg-white shadow-sm' : 'border-gray-200 bg-white/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="marketerAdminLevel"
                      checked={level === lv}
                      onChange={() => applyPresetLevel(lv)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">
                        {MARKETER_ADMIN_LEVEL_LABEL[lv]}
                      </span>
                      <span className="block text-xs text-gray-600 mt-0.5">{levelHint(lv)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {isModifiedFromPreset ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                  기준: {MARKETER_ADMIN_LEVEL_LABEL[level]} · 일부 수정됨
                </p>
              ) : null}
              <button
                type="button"
                onClick={resetToPreset}
                className="text-xs text-slate-600 hover:text-slate-900 underline underline-offset-2"
              >
                선택한 단계 기본값으로 되돌리기
              </button>
            </div>

            <div className="space-y-2">
              {catalog.map((group) => {
                const open = openGroups[group.id] ?? true;
                const granted = group.permissions.filter((p) => permissions[p.id]).length;
                return (
                  <div key={group.id} className="rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !open }))}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
                    >
                      <span>{group.label}</span>
                      <span className="text-xs font-normal text-gray-500">
                        {granted}/{group.permissions.length}
                      </span>
                    </button>
                    {open ? (
                      <ul className="divide-y divide-gray-100">
                        {group.permissions.map((perm) => {
                          const locked = MARKETER_ADMIN_LOCKED_PERMISSION_IDS.includes(perm.id);
                          const modOff = Boolean(perm.featureModuleId && !featureEnabled(perm.featureModuleId));
                          const disabled = locked || modOff;
                          return (
                            <li
                              key={perm.id}
                              className={`px-3 py-2.5 flex items-start gap-3 ${modOff ? 'bg-gray-50/80' : ''}`}
                            >
                              <input
                                type="checkbox"
                                id={`perm-${perm.id}`}
                                checked={Boolean(permissions[perm.id])}
                                disabled={disabled}
                                onChange={(e) => togglePermission(perm.id, e.target.checked)}
                                className="mt-0.5"
                              />
                              <label htmlFor={`perm-${perm.id}`} className="min-w-0 flex-1 cursor-pointer">
                                <span className="block text-sm text-gray-900">{perm.label}</span>
                                <span className="block text-xs text-gray-500 mt-0.5">{perm.description}</span>
                                {locked ? (
                                  <span className="block text-[11px] text-slate-500 mt-1">ADMIN 전용 — 부여 불가</span>
                                ) : null}
                                {modOff ? (
                                  <span className="block text-[11px] text-gray-400 mt-1">기능 미사용 중</span>
                                ) : null}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={saving || !dirty || !selectedUserId}
                onClick={() => void handleSave()}
                className="inline-flex justify-center rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
              >
                {saving ? '저장 중…' : '권한 저장'}
              </button>
              {saveOk ? <span className="text-sm text-green-700">저장되었습니다.</span> : null}
              {saveError ? <span className="text-sm text-red-600">{saveError}</span> : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">권한을 설정할 마케터를 등록해 주세요.</p>
        )}
      </section>

      <section className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
        <p className="font-medium text-slate-800 mb-1">항상 관리자(ADMIN)만 가능</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>다른 마케터 권한 변경(본 화면)</li>
          <li>업체 소유자 전용(접수 변경 이력 삭제, 광고 채널 일부 설정 등)</li>
        </ul>
      </section>
    </div>
  );
}
