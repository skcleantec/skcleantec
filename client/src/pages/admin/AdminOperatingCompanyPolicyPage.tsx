import { useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  getOperatingCompanyPolicy,
  updateOperatingCompanyPolicy,
  type OperatingCompanyPolicy,
} from '../../api/operatingCompanies';

const DEFAULT_POLICY: OperatingCompanyPolicy = {
  assignmentMode: 'relaxed',
  teamLeaderListMode: 'tenant_all_read',
  inquiryDefaultMode: 'user_primary',
};

export function AdminOperatingCompanyPolicyPage() {
  const token = getToken();
  const [policy, setPolicy] = useState<OperatingCompanyPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getOperatingCompanyPolicy(token)
      .then((r) => setPolicy(r.policy))
      .catch((e) => setErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await updateOperatingCompanyPolicy(token, policy);
      setPolicy(r.policy);
      setSavedMsg('저장했습니다.');
      window.setTimeout(() => setSavedMsg(null), 4000);
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
        <h1 className="text-xl font-semibold text-gray-800">영업 브랜드 운영 정책</h1>
        <p className="mt-1 text-sm text-gray-500">
          테넌트 전체에 적용되는 규칙입니다. 관리자(ADMIN)는 정책과 무관하게 전체 접근이 가능합니다.
        </p>
      </div>

      {err ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{err}</div>
      ) : null}
      {savedMsg ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{savedMsg}</p>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">배정 정책</label>
          <p className="text-xs text-gray-500">접수에 팀장을 배정할 때 적용됩니다.</p>
          <select
            value={policy.assignmentMode}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                assignmentMode: e.target.value as OperatingCompanyPolicy['assignmentMode'],
              }))
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="relaxed">완화 — 다른 브랜드 팀장도 배정 가능</option>
            <option value="strict">엄격 — 접수 브랜드 소속 팀장만 배정</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">팀장 화면 목록</label>
          <p className="text-xs text-gray-500">팀장 앱에서 보이는 접수·일정 범위입니다.</p>
          <select
            value={policy.teamLeaderListMode}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                teamLeaderListMode: e.target.value as OperatingCompanyPolicy['teamLeaderListMode'],
              }))
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="tenant_all_read">테넌트 전체 조회 (배정은 위 정책 따름)</option>
            <option value="own_brands_only">소속 브랜드 건만 조회</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">접수 자동 귀속</label>
          <p className="text-xs text-gray-500">수기 접수·발주서 등에서 영업 브랜드를 자동으로 정하는 방식입니다.</p>
          <select
            value={policy.inquiryDefaultMode}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                inquiryDefaultMode: e.target.value as OperatingCompanyPolicy['inquiryDefaultMode'],
              }))
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="user_primary">등록자 기본 브랜드 (primary)</option>
            <option value="from_intake_url">유입 URL ?brand= 우선</option>
            <option value="creator_primary">등록자 primary (동일, 명시적 모드)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </section>
    </div>
  );
}
