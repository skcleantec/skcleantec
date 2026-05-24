import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPlatformTenant } from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { TENANT_PLANS } from '@shared/tenantFeatureModules';
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
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2 text-fluid-sm text-gray-500">
        <Link to="/platform/tenants" className="hover:text-gray-800">
          업체 목록
        </Link>
        <span>/</span>
        <span className="text-gray-900">업체 개설</span>
      </div>

      <h1 className="text-fluid-lg font-semibold text-gray-900">새 업체 개설</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">업체 코드 (slug)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="예: acme-clean"
            className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            required
          />
          <p className="text-fluid-2xs text-gray-500 mt-1">로그인 화면 「업체 코드」에 입력하는 값</p>
        </div>
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">업체명</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            required
          />
        </div>
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">플랜</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
          >
            {Object.entries(TENANT_PLANS).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <hr className="border-gray-100" />
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">관리자 아이디</label>
          <input
            value={adminLoginId}
            onChange={(e) => setAdminLoginId(e.target.value.toLowerCase())}
            className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm font-mono"
            spellCheck={false}
            required
          />
          <p className="text-fluid-2xs text-gray-500 mt-1">{tenantLoginIdErrorMessage()}</p>
        </div>
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">관리자 비밀번호</label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            required
          />
        </div>
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">관리자 이름</label>
          <input
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
          />
        </div>
        {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-800 text-white rounded py-2 text-fluid-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {loading ? '생성 중…' : '업체 생성'}
        </button>
      </form>
    </div>
  );
}
