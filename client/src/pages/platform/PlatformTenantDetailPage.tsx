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
import { PlatformTenantFeatureCatalog } from '../../components/platform/PlatformTenantFeatureCatalog';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  EMPTY_TENANT_CONFIG_FORM,
  formFieldsFromTenantConfig,
  tenantConfigFromFormFields,
  type TenantConfigFormFields,
} from '@shared/tenantConfig';
import {
  BTN_DANGER,
  BTN_DANGER_SOLID,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
  PlanBadge,
  PlatformAlert,
  StatusBadge,
} from '../../utils/platformUi';

const PLAN_DESCRIPTIONS: Record<string, { features: string[] }> = {
  starter: {
    features: ['서비스접수·발주서', '스케줄', '배정', '메시지'],
  },
  standard: {
    features: ['Starter 전체 포함', 'C/S 관리', '타업체·외부정산', '크루(현장)', '팀장 통계'],
  },
  premium: {
    features: ['Standard 전체 포함', '광고비 관리', '급여·정산', '전자계약'],
  },
};

const SETTINGS_FIELDS: {
  key: keyof TenantConfigFormFields;
  label: string;
  hint: string;
  placeholder?: string;
}[] = [
  {
    key: 'displayName',
    label: '표시명',
    hint: '로그인·헤더에 표시되는 업체 이름',
    placeholder: '예: A청소',
  },
  {
    key: 'inquiryNumberPrefix',
    label: '접수번호 접두',
    hint: '영문·숫자·_- 만 허용 (예: SK-)',
    placeholder: '예: SK-',
  },
  {
    key: 'loginSubtitle',
    label: '로그인 부제',
    hint: '업체 로그인 화면 한 줄 안내 문구',
    placeholder: '예: 환영합니다',
  },
  {
    key: 'orderFormPublicSubtitle',
    label: '고객 발주서 부제',
    hint: '고객 발주서 상단 안내 — 저장 시 기본 영업 브랜드·고객 화면에 반영',
    placeholder: '예: 아래 내용을 확인 후 작성해 주세요',
  },
];

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'plan', label: '플랜 · 기능' },
  { id: 'settings', label: '설정' },
  { id: 'admins', label: '관리자 계정' },
  { id: 'danger', label: '위험 구역' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type TenantWithStats = PlatformTenantDetail['tenant'] & {
  userCount?: number;
  inquiryCount?: number;
};

type DetailWithStats = PlatformTenantDetail & {
  stats?: { monthInquiryCount?: number };
};

export function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<DetailWithStats | null>(null);
  const [features, setFeatures] = useState<PlatformTenantFeatureRow[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('starter');
  const [admins, setAdmins] = useState<PlatformTenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [configForm, setConfigForm] = useState<TenantConfigFormFields>(EMPTY_TENANT_CONFIG_FORM);
  const [configJson, setConfigJson] = useState('{}');
  const [configErr, setConfigErr] = useState('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const data = (await getPlatformTenant(token, id)) as DetailWithStats;
      setDetail(data);
      setFeatures(data.features.map((f) => ({ ...f })));
      setName(data.tenant.name);
      setSlug(data.tenant.slug);
      setPlan(data.tenant.plan);
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

  const saveBasics = async (overrides?: Partial<{ slug: string; name: string; plan: string; status: string }>) => {
    const token = getPlatformToken();
    if (!token || !id) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        slug: overrides?.slug ?? slug,
        name: overrides?.name ?? name,
        plan: overrides?.plan ?? plan,
        ...(overrides?.status !== undefined ? { status: overrides.status } : {}),
      };
      await patchPlatformTenant(token, id, payload);
      setSlug(payload.slug);
      setName(payload.name);
      setPlan(payload.plan);
      setMessage('저장했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanSelect = async (pid: 'starter' | 'standard' | 'premium') => {
    const token = getPlatformToken();
    if (!token || !id || saving) return;
    setPlan(pid);
    if (pid === detail?.tenant.plan) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await patchPlatformTenant(token, id, { plan: pid });
      const data = await resetPlatformTenantFeaturesFromPlan(token, id);
      setDetail(data);
      setAdmins(normalizePlatformTenantAdmins(data));
      setFeatures(data.features.map((f) => ({ ...f })));
      setPlan(data.tenant.plan);
      setMessage('플랜을 변경하고 기능 모듈을 재설정했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '플랜 변경 실패');
      if (detail) setPlan(detail.tenant.plan);
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (moduleId: string) => {
    setFeatures((prev) =>
      prev.map((f) => (f.moduleId === moduleId && !f.locked ? { ...f, enabled: !f.enabled } : f)),
    );
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
      setMessage('설정을 저장했습니다.');
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
      setMessage('JSON 설정을 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleProxyLogin = () => {
    if (!detail) return;
    const url = `/login?tenant=${encodeURIComponent(detail.tenant.slug)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <p className="p-8 text-center text-sm text-gray-500">불러오는 중…</p>;
  }
  if (!detail) {
    return <p className="p-8 text-center text-sm text-red-600">{error || '업체를 찾을 수 없습니다.'}</p>;
  }

  const tenant = detail.tenant as TenantWithStats;
  const monthInquiry = detail.stats?.monthInquiryCount;
  const userCountLabel =
    tenant.userCount !== undefined ? `${tenant.userCount.toLocaleString()}명` : '—';
  const inquiryCountLabel =
    tenant.inquiryCount !== undefined ? `${tenant.inquiryCount.toLocaleString()}건` : '—';
  const monthInquiryLabel =
    monthInquiry !== undefined ? `${monthInquiry.toLocaleString()}건` : '—';

  return (
    <div className="min-w-0 space-y-5">
      <nav className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link to="/platform/tenants" className="hover:text-gray-900">
          업체 관리
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-900">{detail.tenant.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">{detail.tenant.name}</h1>
        <PlanBadge plan={detail.tenant.plan} />
        <StatusBadge status={detail.tenant.status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={handleProxyLogin} className={BTN_SECONDARY} disabled={saving}>
            대리 로그인
          </button>
          {detail.tenant.status !== 'SUSPENDED' ? (
            <button
              type="button"
              className={BTN_DANGER}
              disabled={saving}
              onClick={() => {
                if (!window.confirm(`${detail.tenant.name} 서비스를 중지할까요?`)) return;
                void saveBasics({ status: 'SUSPENDED' });
              }}
            >
              서비스 중지
            </button>
          ) : (
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={saving}
              onClick={() => void saveBasics({ status: 'ACTIVE' })}
            >
              서비스 재개
            </button>
          )}
        </div>
      </div>

      {message ? <PlatformAlert message={message} variant="success" /> : null}
      {error ? <PlatformAlert message={error} variant="error" /> : null}

      <div className="flex gap-0 overflow-x-auto border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              tab.id === 'danger' && activeTab !== 'danger'
                ? 'text-red-400 hover:border-red-300 hover:text-red-600'
                : '',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '사용자', value: userCountLabel },
              { label: '총 접수', value: inquiryCountLabel },
              { label: '이달 접수', value: monthInquiryLabel },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="mt-1 text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          <section className={CARD_SECTION}>
            <h2 className="text-base font-semibold text-gray-900">기본 정보</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">업체명</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={INPUT_BASE}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">업체 코드 (slug)</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className={`${INPUT_BASE} font-mono`}
                  spellCheck={false}
                />
                <p className="mt-1 text-[10px] text-amber-700">
                  변경 시 로그인 URL·서브도메인·북마크가 바뀝니다.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">가입일</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {detail.tenant.createdAt
                    ? new Date(detail.tenant.createdAt).toLocaleDateString('ko-KR')
                    : '—'}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">현재 플랜</label>
                <div className="pt-0.5">
                  <PlanBadge plan={detail.tenant.plan} />
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => void saveBasics()}
                disabled={saving}
                className={BTN_PRIMARY}
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'plan' ? (
        <div className="space-y-5">
          <section className={CARD_SECTION}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">플랜 선택</h2>
              <p className="text-xs text-gray-400">변경 시 기능 모듈이 자동 재설정됩니다</p>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(['starter', 'standard', 'premium'] as const).map((pid) => {
                const isSelected = plan === pid;
                const desc = PLAN_DESCRIPTIONS[pid];
                return (
                  <button
                    key={pid}
                    type="button"
                    disabled={saving}
                    onClick={() => void handlePlanSelect(pid)}
                    className={[
                      'rounded-xl border-2 p-4 text-left transition-all',
                      pid === 'premium' && isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : pid === 'standard' && isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : isSelected
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'mb-2 text-sm font-bold capitalize',
                        pid === 'premium' && isSelected
                          ? 'text-purple-700'
                          : pid === 'standard' && isSelected
                            ? 'text-blue-700'
                            : 'text-gray-900',
                      ].join(' ')}
                    >
                      {pid.charAt(0).toUpperCase() + pid.slice(1)}
                      {isSelected ? ' ✓' : ''}
                    </div>
                    <ul className="space-y-1">
                      {desc.features.map((f) => (
                        <li key={f} className="text-xs text-gray-500">
                          · {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => void saveBasics()}
                disabled={saving}
                className={BTN_PRIMARY}
              >
                플랜 저장
              </button>
            </div>
          </section>

          <section className={CARD_SECTION}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">기능 모듈 개별 설정</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  테넌트 GNB·하위 메뉴를 카테고리별로 보고, 연결된 기능 모듈을 on/off 할 수 있습니다. core
                  모듈은 잠겨 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleResetFromPlan()}
                disabled={saving}
                className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
              >
                플랜 기본값으로 재설정
              </button>
            </div>
            <PlatformTenantFeatureCatalog
              features={features}
              onToggle={toggleFeature}
              disabled={saving}
            />
            <div className="flex justify-end border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => void handleSaveFeatures()}
                disabled={saving}
                className={BTN_PRIMARY}
              >
                {saving ? '저장 중…' : '기능 저장'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <div className="space-y-5">
          <section className={CARD_SECTION}>
            <h2 className="text-base font-semibold text-gray-900">화면 표시 설정</h2>
            <p className="mb-4 mt-0.5 text-xs text-gray-500">
              코드 없이 입력만으로 업체별 표시 문구와 기본값을 설정합니다.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {SETTINGS_FIELDS.map((row) => (
                <div key={row.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{row.label}</label>
                  <input
                    type="text"
                    value={configForm[row.key]}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, [row.key]: e.target.value }))}
                    placeholder={row.placeholder}
                    className={INPUT_BASE}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">{row.hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => void handleSaveConfigForm()}
                disabled={saving}
                className={BTN_PRIMARY}
              >
                {saving ? '저장 중…' : '설정 저장'}
              </button>
            </div>
          </section>

          <details className={`${CARD_SECTION} group`}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-500">
              <span className="inline-block transition-transform group-open:rotate-90">▶</span>
              고급 · JSON 직접 편집
            </summary>
            <p className="mb-3 mt-2 text-xs text-gray-400">
              JSON으로 전체 설정을 직접 수정합니다. 잘못된 값은 서비스에 영향을 줄 수 있습니다.
            </p>
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
            {configErr ? <p className="mt-2 text-xs text-red-600">{configErr}</p> : null}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveConfigJson()}
                disabled={saving}
                className={`${BTN_SECONDARY} px-3 py-1.5 text-xs`}
              >
                JSON으로 저장
              </button>
            </div>
          </details>
        </div>
      ) : null}

      {activeTab === 'admins' ? (
        <section className={CARD_SECTION}>
          <h2 className="text-base font-semibold text-gray-900">관리자 계정</h2>
          <p className="mb-4 text-xs text-gray-500">
            이 업체에 관리자 권한으로 로그인할 수 있는 계정 목록입니다.
          </p>
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
        </section>
      ) : null}

      {activeTab === 'danger' ? (
        <div className="space-y-0 rounded-xl border border-red-100 bg-white p-6">
          <h2 className="mb-1 text-base font-semibold text-red-600">⚠ 위험 구역</h2>
          <p className="mb-5 text-xs text-gray-500">아래 작업은 되돌리기 어렵습니다. 신중하게 사용하세요.</p>

          <div className="flex items-start justify-between gap-4 border-b border-red-50 py-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">서비스 일시 중지</div>
              <div className="mt-1 text-xs text-gray-400">
                이 업체의 모든 로그인을 즉시 차단합니다. 재개 시 정상 복원됩니다.
              </div>
            </div>
            {detail.tenant.status !== 'SUSPENDED' ? (
              <button
                type="button"
                className={`${BTN_DANGER} shrink-0`}
                disabled={saving}
                onClick={() => {
                  if (!window.confirm(`${detail.tenant.name} 서비스를 중지할까요?`)) return;
                  void saveBasics({ status: 'SUSPENDED' });
                }}
              >
                서비스 중지
              </button>
            ) : (
              <button
                type="button"
                className={`${BTN_SECONDARY} shrink-0`}
                disabled={saving}
                onClick={() => void saveBasics({ status: 'ACTIVE' })}
              >
                서비스 재개
              </button>
            )}
          </div>

          {detail.tenant.status === 'TRIAL' ? (
            <div className="flex items-start justify-between gap-4 border-b border-red-50 py-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">체험 → 운영 전환</div>
                <div className="mt-1 text-xs text-gray-400">
                  체험 기간을 종료하고 정식 운영 상태로 변경합니다.
                </div>
              </div>
              <button
                type="button"
                className={`${BTN_SECONDARY} shrink-0`}
                disabled={saving}
                onClick={() => {
                  if (!window.confirm('체험을 종료하고 운영으로 전환할까요?')) return;
                  void saveBasics({ status: 'ACTIVE' });
                }}
              >
                운영으로 전환
              </button>
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-4 pt-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">테넌트 삭제</div>
              <div className="mt-1 text-xs text-gray-400">
                업체와 모든 데이터를 영구 삭제합니다. 복구가 불가능합니다.
              </div>
            </div>
            <button
              type="button"
              disabled
              title="추후 구현 예정"
              className={`${BTN_DANGER_SOLID} shrink-0 cursor-not-allowed opacity-40`}
            >
              삭제
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
