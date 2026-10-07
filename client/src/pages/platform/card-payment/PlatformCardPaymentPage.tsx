import { useEffect, useState } from 'react';
import { CARD_SECTION, BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE } from '../../../utils/platformUi';
import { PlatformCardPaymentKeySection } from './PlatformCardPaymentKeySection';
import { PlatformUsageFeeCheck } from './PlatformUsageFeeCheck';
import {
  fetchPlatformCardPaymentSettings,
  fetchPlatformPgOnboardings,
  patchPlatformPgOnboarding,
  savePlatformCardPaymentSettings,
} from '../../../api/platformCardPayment';
import { formatFeeBps, formatWon, TENANT_PG_ONBOARDING_STATUS_LABEL } from '@shared/cardPayment';
import type { TenantPgOnboardingStatus } from '@shared/cardPayment';

export function PlatformCardPaymentPage() {
  const [tenantFeeBps, setTenantFeeBps] = useState(330);
  const [platformCostBps, setPlatformCostBps] = useState(260);
  const [summary, setSummary] = useState({
    approvedCount: 0,
    amountWon: 0,
    tenantFeeWon: 0,
    platformCostWon: 0,
    platformSpreadWon: 0,
  });
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof fetchPlatformPgOnboardings>>['items']
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serviceBridge, setServiceBridge] = useState<
    Awaited<ReturnType<typeof fetchPlatformCardPaymentSettings>>['serviceBridge']
  >(undefined);

  const reload = () => {
    void Promise.all([fetchPlatformCardPaymentSettings(), fetchPlatformPgOnboardings({ limit: 50, offset: 0 })])
      .then(([s, list]) => {
        setTenantFeeBps(s.tenantFeeBps);
        setPlatformCostBps(s.platformCostBps);
        setSummary(s.summary);
        setServiceBridge(s.serviceBridge);
        setItems(list.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6 pb-8 min-w-0 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">카드결제 PG</h1>
        <p className="mt-1 text-sm text-gray-500">테넌트 가입 신청 · 키 연결 · 수수료(부가세 포함)</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">수수료</h2>
        <p className="mt-1 text-xs text-gray-500">
          업체 {formatFeeBps(tenantFeeBps)} · PG 원가 {formatFeeBps(platformCostBps)} · 차액{' '}
          {formatFeeBps(tenantFeeBps - platformCostBps)}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-600">
            테넌트 수수료 (만분율)
            <input
              className={`${INPUT_BASE} mt-1`}
              value={tenantFeeBps}
              onChange={(e) => setTenantFeeBps(Number(e.target.value) || 0)}
            />
          </label>
          <label className="text-sm text-gray-600">
            플랫폼 PG 원가 (만분율)
            <input
              className={`${INPUT_BASE} mt-1`}
              value={platformCostBps}
              onChange={(e) => setPlatformCostBps(Number(e.target.value) || 0)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          className={`${BTN_PRIMARY} mt-3`}
          onClick={() => {
            setSaving(true);
            void savePlatformCardPaymentSettings({ tenantFeeBps, platformCostBps })
              .then(() => reload())
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '저장 실패'))
              .finally(() => setSaving(false));
          }}
        >
          수수료 저장
        </button>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">완료 건</dt>
            <dd className="font-medium">{summary.approvedCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500">결제합계</dt>
            <dd className="font-medium">{formatWon(summary.amountWon)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">PG 원가</dt>
            <dd className="font-medium">{formatWon(summary.platformCostWon)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">플랫폼 차액</dt>
            <dd className="font-medium">{formatWon(summary.platformSpreadWon)}</dd>
          </div>
        </dl>
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">이용료 결제 (서비스브릿지)</h2>
        <p className="mt-1 text-xs text-gray-500">
          솔루션 이용료 전용입니다. 팀장 청소비 결재에는 쓰이지 않습니다. 결제창은 신용카드 창이 열리는지 확인용이고, 수기는 키 연결만 확인합니다.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-800">
          <li>
            수기(구인증){' '}
            {serviceBridge?.keyin.configured
              ? `연결됨 · MID ${serviceBridge.keyin.mid} · OID ${serviceBridge.keyin.oid}`
              : '아직 서버에 키가 없습니다.'}
          </li>
          <li>
            앱카드(인증){' '}
            {serviceBridge?.appCard.configured
              ? `연결됨 · MID ${serviceBridge.appCard.mid} · OID ${serviceBridge.appCard.oid}`
              : '아직 서버에 키가 없습니다.'}
          </li>
        </ul>
        <PlatformUsageFeeCheck />
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">업체 결제 키</h2>
        <PlatformCardPaymentKeySection />
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">가입 신청</h2>
        <div className="mt-3 space-y-2">
          {items.length === 0 ? <p className="text-sm text-gray-500">신청이 없습니다.</p> : null}
          {items.map((row) => (
            <article key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm">
              <p className="font-medium text-gray-900">
                {row.tenant.name} <span className="text-xs text-gray-500">({row.tenant.slug})</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {TENANT_PG_ONBOARDING_STATUS_LABEL[row.status as TenantPgOnboardingStatus]} · {row.businessName ?? '상호 없음'} ·{' '}
                {row.contactPhone ?? ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => void patchPlatformPgOnboarding(row.tenant.id, { status: 'FORWARDED_TO_PG' }).then(reload)}
                >
                  PG 전달
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
