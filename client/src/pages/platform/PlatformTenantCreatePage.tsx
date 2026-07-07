import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPlatformTenant } from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { TENANT_PLANS } from '@shared/tenantFeatureModules';
import { TENANT_PLAN_PRESENTATIONS, planLimitsSummary } from '@shared/tenantPlanCatalog';
import { tenantLoginIdErrorMessage } from '@shared/tenantLoginId';

export function PlatformTenantCreatePage() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<string>('starter');
  const [adminLoginId, setAdminLoginId] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('관리자');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getPlatformToken();
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      const result = (await createPlatformTenant(token, {
        slug,
        name,
        plan,
        adminLoginId,
        adminPassword,
        adminName,
      })) as { tenant: { id: string } };
      navigate(`/platform/tenants/${result.tenant.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 min-w-0">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-fluid-sm text-slate-500">
          <Link to="/platform/tenants" className="hover:text-slate-800">
            업체 목록
          </Link>
          <span>/</span>
          <span className="text-slate-900">업체 개설</span>
        </div>
        <h1 className="mt-2 text-fluid-lg font-semibold text-slate-900">새 업체 개설</h1>
        <p className="mt-1 text-fluid-xs text-slate-500">업체 코드·플랜·초기 관리자 계정을 등록합니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-fluid-xs text-gray-600">업체 코드 (slug)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="예: acme-clean"
              className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm font-mono"
              required
            />
            <p className="mt-1 text-fluid-2xs text-gray-500">로그인 화면 「업체 코드」에 입력하는 값</p>
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs text-gray-600">업체명</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-fluid-xs text-gray-600">플랜</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm"
            >
              {Object.entries(TENANT_PLANS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                  {TENANT_PLAN_PRESENTATIONS[id as keyof typeof TENANT_PLAN_PRESENTATIONS]?.recommended
                    ? ' (추천)'
                    : ''}
                </option>
              ))}
            </select>
            {plan in TENANT_PLAN_PRESENTATIONS ? (
              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-fluid-2xs text-slate-600">
                <p className="font-medium text-slate-800">
                  {TENANT_PLAN_PRESENTATIONS[plan as keyof typeof TENANT_PLAN_PRESENTATIONS].tagline}
                </p>
                <p className="mt-0.5">
                  {TENANT_PLAN_PRESENTATIONS[plan as keyof typeof TENANT_PLAN_PRESENTATIONS].monthlyPriceHint}
                  {' · '}
                  {TENANT_PLAN_PRESENTATIONS[plan as keyof typeof TENANT_PLAN_PRESENTATIONS].annualPriceHint}
                </p>
                <p className="mt-1 text-slate-500">
                  포함량: {planLimitsSummary(plan as keyof typeof TENANT_PLAN_PRESENTATIONS).join(' · ')}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <hr className="border-slate-100" />
        <p className="text-fluid-xs font-medium text-slate-700">초기 관리자 계정</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-fluid-xs text-gray-600">관리자 아이디</label>
            <input
              value={adminLoginId}
              onChange={(e) => setAdminLoginId(e.target.value.toLowerCase())}
              className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm font-mono"
              spellCheck={false}
              required
            />
            <p className="mt-1 text-fluid-2xs text-gray-500">{tenantLoginIdErrorMessage()}</p>
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs text-gray-600">관리자 비밀번호</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-fluid-xs text-gray-600">관리자 이름</label>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm"
            />
          </div>
        </div>
        {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-800 py-2.5 text-fluid-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {loading ? '생성 중…' : '업체 생성'}
        </button>
      </form>
    </div>
  );
}
