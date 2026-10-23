import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CARD_SECTION, BTN_SECONDARY } from '../../../utils/platformUi';
import { PlatformCardPaymentKeySection } from './PlatformCardPaymentKeySection';
import { PlatformUsageFeeCheck } from './PlatformUsageFeeCheck';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import {
  fetchPlatformCardPaymentSettings,
  fetchPlatformPgOnboardings,
  patchPlatformPgOnboarding,
} from '../../../api/platformCardPayment';
import { formatWon, TENANT_PG_ONBOARDING_STATUS_LABEL } from '@shared/cardPayment';
import type { TenantPgOnboardingStatus } from '@shared/cardPayment';

export function PlatformCardPaymentPage() {
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
  const [serviceBridge, setServiceBridge] = useState<
    Awaited<ReturnType<typeof fetchPlatformCardPaymentSettings>>['serviceBridge']
  >(undefined);

  const reload = () => {
    void Promise.all([fetchPlatformCardPaymentSettings(), fetchPlatformPgOnboardings({ limit: 50, offset: 0 })])
      .then(([s, list]) => {
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
        <PlatformCardPaymentTabs />
        <p className="mt-1 text-sm text-gray-500">테넌트 가입 신청 · 키 연결 · 수수료(부가세 포함)</p>
      </div>

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">원성 로그인 주소</h2>
        <p className="mt-1 text-xs text-gray-500">원성 본사에서 PG 신청과 취소·환불을 보는 주소입니다.</p>
        <p className="break-all text-sm text-gray-800">{`${window.location.origin}/pg-partner`}</p>
        <button
          type="button"
          className={`${BTN_SECONDARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2`}
          onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/pg-partner`)}
        >
          주소 복사
        </button>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">수수료</h2>
        <p className="mt-1 text-xs text-gray-500">
          서비스브릿지와 가맹점 사이 마진은 기간·가맹점별로 수수료 현황에서 봅니다. 전체 완료 {summary.approvedCount}건 · 결제합계{' '}
          {formatWon(summary.amountWon)} · 서비스브릿지 {formatWon(summary.platformCostWon)} · 마진 {formatWon(summary.platformSpreadWon)}
        </p>
        <Link
          to="/platform/card-payment/fees"
          className={`${BTN_SECONDARY} mt-3 inline-flex hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2`}
        >
          수수료 현황
        </Link>
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-sm font-semibold text-gray-900">이용료 결제 (서비스브릿지)</h2>
        <p className="mt-1 text-xs text-gray-500">
          솔루션 이용료 전용입니다. 팀장 청소비 결재에는 쓰이지 않습니다. 수기 승인은 카드결재 탭에서 받습니다.
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
