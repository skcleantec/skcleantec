import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getPlatformTenant,
  normalizePlatformTenantAdmins,
  patchPlatformTenant,
  patchPlatformTenantConfig,
  resetPlatformTenantFeaturesFromPlan,
  savePlatformTenantFeatures,
  type PlatformTenantAdmin,
  type PlatformTenantDetail,
  type PlatformTenantFeatureRow,
} from '../../api/platformTenants';
import { PlatformTenantAdminsSection } from './PlatformTenantAdminsSection';
import { getPlatformToken } from '../../stores/platformAuth';
import { TENANT_PLANS } from '@shared/tenantFeatureModules';
import {
  EMPTY_TENANT_CONFIG_FORM,
  formFieldsFromTenantConfig,
  tenantConfigFromFormFields,
  type TenantConfigFormFields,
} from '@shared/tenantConfig';

const STATUS_OPTIONS = [
  { value: 'TRIAL', label: '체험' },
  { value: 'ACTIVE', label: '운영' },
  { value: 'SUSPENDED', label: '중지' },
];

const L1_FORM_ROWS: {
  key: keyof TenantConfigFormFields;
  label: string;
  hint: string;
  placeholder?: string;
}[] = [
  {
    key: 'displayName',
    label: '표시명',
    hint: '로그인·헤더에 보이는 이름. 비우면 업체명을 씁니다.',
    placeholder: '예: A청소',
  },
  {
    key: 'loginSubtitle',
    label: '로그인 부제',
    hint: '업체 로그인 화면 한 줄 안내',
    placeholder: '예: 환영합니다',
  },
  {
    key: 'orderFormPublicSubtitle',
    label: '고객 발주서 부제',
    hint: '고객이 여는 발주서 링크 상단 문구',
    placeholder: '예: 아래 내용을 확인 후 작성해 주세요',
  },
  {
    key: 'inquiryNumberPrefix',
    label: '접수번호 접두',
    hint: '영문·숫자·_- 만 (예: SK-)',
    placeholder: '예: SK-',
  },
];

export function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PlatformTenantDetail | null>(null);
  const [features, setFeatures] = useState<PlatformTenantFeatureRow[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('starter');
  const [status, setStatus] = useState('TRIAL');
  const [admins, setAdmins] = useState<PlatformTenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [configForm, setConfigForm] = useState<TenantConfigFormFields>(EMPTY_TENANT_CONFIG_FORM);
  const [configJson, setConfigJson] = useState('{}');
  const [configErr, setConfigErr] = useState('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPlatformTenant(token, id);
      setDetail(data);
      setFeatures(data.features.map((f) => ({ ...f })));
      setName(data.tenant.name);
      setSlug(data.tenant.slug);
      setPlan(data.tenant.plan);
      setStatus(data.tenant.status);
      setAdmins(normalizePlatformTenantAdmins(data));
      setConfigForm(formFieldsFromTenantConfig(data.config));
      setConfigJson(JSON.stringify(data.config ?? {}, null, 2));
      setConfigErr('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFeature = (moduleId: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.moduleId === moduleId && !f.locked ? { ...f, enabled: !f.enabled } : f)),
    );
  };

  const handleSaveBasics = async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await patchPlatformTenant(token, id, { slug, name, plan, status });
      setMessage('기본 정보를 저장했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeatures = async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = features
        .filter((f) => !f.locked)
        .map((f) => ({ moduleId: f.moduleId, enabled: f.enabled }));
      const data = await savePlatformTenantFeatures(token, id, payload);
      setDetail(data);
      setAdmins(normalizePlatformTenantAdmins(data));
      setFeatures(data.features.map((f) => ({ ...f })));
      setMessage('기능 모듈을 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '기능 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleResetFromPlan = async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    if (!window.confirm('플랜 기본 모듈로 기능 설정을 재설정할까요?')) return;
    setSaving(true);
    setError('');
    try {
      const data = await resetPlatformTenantFeaturesFromPlan(token, id);
      setDetail(data);
      setAdmins(normalizePlatformTenantAdmins(data));
      setFeatures(data.features.map((f) => ({ ...f })));
      setMessage('플랜 기본값으로 재설정했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '재설정 실패');
    } finally {
      setSaving(false);
    }
  };

  const applyConfigResponse = (config: Record<string, unknown> | undefined) => {
    setConfigForm(formFieldsFromTenantConfig(config));
    setConfigJson(JSON.stringify(config ?? {}, null, 2));
  };

  const handleSaveConfigForm = async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setSaving(true);
    setMessage('');
    setError('');
    setConfigErr('');
    try {
      const payload = tenantConfigFromFormFields(configForm);
      const { config } = await patchPlatformTenantConfig(token, id, payload);
      applyConfigResponse(config);
      setMessage('L1 설정을 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfigJson = async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setSaving(true);
    setMessage('');
    setError('');
    setConfigErr('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(configJson) as unknown;
    } catch {
      setConfigErr('JSON 형식이 올바르지 않습니다.');
      setSaving(false);
      return;
    }
    try {
      const { config } = await patchPlatformTenantConfig(token, id, parsed);
      applyConfigResponse(config);
      setMessage('L1 설정(JSON)을 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-gray-500 p-8 text-center">불러오는 중…</p>;
  }
  if (!detail) {
    return <p className="text-fluid-sm text-red-600 p-8 text-center">{error || '업체를 찾을 수 없습니다.'}</p>;
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-fluid-sm text-gray-500">
        <Link to="/platform/tenants" className="hover:text-gray-800">
          업체 목록
        </Link>
        <span>/</span>
        <span className="text-gray-900">{detail.tenant.name}</span>
      </div>

      <div>
        <h1 className="text-fluid-lg font-semibold text-gray-900">{detail.tenant.name}</h1>
        <p className="text-fluid-xs text-gray-500 mt-1 font-mono">{detail.tenant.slug}</p>
        {admins.length > 0 ? (
          <p className="text-fluid-xs text-gray-600 mt-1">
            관리자 {admins.length}명:{' '}
            <span className="font-mono">{admins.map((a) => a.loginId).join(', ')}</span>
          </p>
        ) : null}
      </div>

      {message ? <p className="text-fluid-xs text-green-700 bg-green-50 border border-green-100 rounded px-3 py-2">{message}</p> : null}
      {error ? <p className="text-fluid-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p> : null}

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <h2 className="text-fluid-sm font-semibold text-gray-800">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">업체 코드 (slug)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm font-mono"
              spellCheck={false}
            />
            <p className="text-fluid-2xs text-amber-700 mt-1">
              변경 시 로그인 URL(?tenant=), 서브도메인·북마크가 바뀝니다. 영문 소문자·숫자·하이픈만.
            </p>
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">업체명</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            />
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">플랜</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            >
              {Object.entries(TENANT_PLANS).map(([pid, p]) => (
                <option key={pid} value={pid}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveBasics()}
          disabled={saving}
          className="px-4 py-2 bg-gray-800 text-white text-fluid-sm rounded hover:bg-gray-900 disabled:opacity-50"
        >
          기본 정보 저장
        </button>
      </section>

      {id ? (
        <PlatformTenantAdminsSection
          tenantId={id}
          admins={admins}
          onChanged={load}
          saving={saving}
          setSaving={setSaving}
          setMessage={setMessage}
          setError={setError}
        />
      ) : null}

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-fluid-sm font-semibold text-gray-800">기능 모듈</h2>
          <button
            type="button"
            onClick={() => void handleResetFromPlan()}
            disabled={saving}
            className="text-fluid-xs text-gray-600 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
          >
            플랜 기본값으로 재설정
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {features.map((f) => (
            <li key={f.moduleId} className="py-3 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="text-fluid-sm text-gray-900 truncate">{f.label}</div>
                <div className="text-fluid-2xs text-gray-500">
                  {f.moduleId}
                  {f.locked ? ' · core(잠금)' : ''}
                  {!f.inPlan ? ' · 플랜 외' : ''}
                </div>
              </div>
              <label className="flex items-center gap-2 shrink-0 text-fluid-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  disabled={f.locked}
                  onChange={() => toggleFeature(f.moduleId)}
                />
                {f.effective ? 'ON' : 'OFF'}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void handleSaveFeatures()}
          disabled={saving}
          className="px-4 py-2 bg-gray-800 text-white text-fluid-sm rounded hover:bg-gray-900 disabled:opacity-50"
        >
          기능 모듈 저장
        </button>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-fluid-sm font-semibold text-gray-800">L1 설정</h2>
          <p className="text-fluid-xs text-gray-500 mt-1">
            업체별 문구·기본값 — 코드 없이 입력만 하면 됩니다.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {L1_FORM_ROWS.map((row) => (
            <div key={row.key} className={row.key === 'loginSubtitle' || row.key === 'orderFormPublicSubtitle' ? 'sm:col-span-2' : ''}>
              <label className="block text-fluid-xs font-medium text-gray-700 mb-1">{row.label}</label>
              <input
                type="text"
                value={configForm[row.key]}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, [row.key]: e.target.value }))}
                placeholder={row.placeholder}
                className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm"
              />
              <p className="text-fluid-2xs text-gray-500 mt-1">{row.hint}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleSaveConfigForm()}
          disabled={saving}
          className="px-4 py-2 bg-gray-800 text-white text-fluid-sm rounded hover:bg-gray-900 disabled:opacity-50"
        >
          L1 설정 저장
        </button>

        <details className="border border-gray-100 rounded-lg p-3 bg-gray-50">
          <summary className="text-fluid-xs text-gray-600 cursor-pointer select-none">
            고급 · JSON 직접 편집
          </summary>
          <div className="mt-3 space-y-2">
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full font-mono text-fluid-xs border border-gray-300 rounded px-3 py-2 bg-white"
            />
            {configErr ? <p className="text-fluid-xs text-red-600">{configErr}</p> : null}
            <button
              type="button"
              onClick={() => void handleSaveConfigJson()}
              disabled={saving}
              className="px-3 py-1.5 text-fluid-xs border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              JSON으로 저장
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}

