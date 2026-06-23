import { useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import {
  getTenantStaffAccessSettings,
  updateTenantStaffAccessSettings,
} from '../../api/tenantStaffAccess';

export function AdminStaffAccessSettingsPage() {
  const token = getToken();
  const [marketerAdminAccess, setMarketerAdminAccess] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void getMe(token)
      .then((u) => setCanEdit(u.role === 'ADMIN'))
      .catch(() => setCanEdit(false));
    getTenantStaffAccessSettings(token)
      .then((r) => setMarketerAdminAccess(r.marketerAdminAccess))
      .catch((e) => setErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await updateTenantStaffAccessSettings(token, marketerAdminAccess);
      setMarketerAdminAccess(r.marketerAdminAccess);
      setSavedMsg('저장했습니다. 마케터 계정은 다시 로그인하거나 새로고침 후 메뉴가 반영됩니다.');
      window.setTimeout(() => setSavedMsg(null), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">직원 권한 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          업체 전체에 적용됩니다. 마케터에게 관리자와 동일한 업무 메뉴·API 접근을 허용할지 정합니다.
        </p>
      </div>

      {err ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>
      ) : null}
      {savedMsg ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{savedMsg}</p>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <label className={`flex items-start gap-3 ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}`}>
          <input
            type="checkbox"
            className="mt-1"
            checked={marketerAdminAccess}
            disabled={!canEdit}
            onChange={(e) => setMarketerAdminAccess(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">마케터에게 관리자 권한 부여</span>
            <span className="block mt-1 text-xs text-gray-500 leading-relaxed">
              켜면 마케터도 사용자 등록·팀장/타업체 관리·정산·광고비 설정 등 관리자 전용 메뉴를 사용할 수
              있습니다. 접수·스케줄·발주서 등 기존 마케터 업무는 그대로 가능합니다.
            </span>
          </span>
        </label>

        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
          <p className="font-medium text-slate-800 mb-1">항상 관리자(ADMIN)만 가능한 기능</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>이 권한 설정 변경</li>
            <li>업체 소유자 전용 기능(접수 변경 이력 삭제, 광고 채널 일부 설정 등)</li>
            <li>팀·크루 화면 미리보기(개발용)</li>
          </ul>
        </div>

        {!canEdit ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
            이 설정은 관리자(ADMIN) 계정만 변경할 수 있습니다.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !canEdit}
          className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </section>
    </div>
  );
}
