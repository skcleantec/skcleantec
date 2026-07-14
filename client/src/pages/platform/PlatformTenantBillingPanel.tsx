import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateAnnualFromMonthlyKrw,
  formatNextDueDateLabel,
  formatBillingAnchorDayLabel,
  TENANT_BILLING_CYCLE_LABEL,
  TENANT_BILLING_PRICING_MODE_LABEL,
  billingCyclePriceHint,
  type TenantBillingCycle,
  type TenantBillingPricingMode,
} from '@shared/tenantBilling';
import type { TenantPlanId } from '@shared/tenantFeatureModules';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import {
  confirmPlatformPrepaid,
  getPlatformTenantBilling,
  patchPlatformTenantBillingProfile,
  type PlatformTenantBillingDetail,
} from '../../api/platformBilling';
import { PlatformTenantBillingScheduleSection } from './PlatformTenantBillingScheduleSection';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  CARD_SECTION,
  INPUT_BASE,
  BillingOperationalBadge,
  PlanBadge,
  PlatformAlert,
  StatusBadge,
} from '../../utils/platformUi';

function formatKoDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function ymdFromIso(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

type Props = {
  tenantId: string;
  compact?: boolean;
};

const PLAN_OPTIONS: TenantPlanId[] = ['starter', 'standard', 'premium'];

type ContractForm = {
  plan: TenantPlanId;
  billingCycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  customMonthlyAmountKrw: string;
  customAnnualAmountKrw: string;
  useCustomAnnual: boolean;
  billingStartDate: string;
  autoIssueEnabled: boolean;
  contractMemo: string;
};

function contractFormFromDetail(detail: PlatformTenantBillingDetail): ContractForm {
  const plan = (detail.tenant.plan in TENANT_PLAN_PRESENTATIONS
    ? detail.tenant.plan
    : 'standard') as TenantPlanId;
  return {
    plan,
    billingCycle: detail.profile.billingCycle,
    pricingMode: detail.profile.pricingMode,
    customMonthlyAmountKrw:
      detail.profile.customMonthlyAmountKrw != null
        ? String(detail.profile.customMonthlyAmountKrw)
        : '',
    customAnnualAmountKrw:
      detail.profile.customAnnualAmountKrw != null
        ? String(detail.profile.customAnnualAmountKrw)
        : '',
    useCustomAnnual: detail.profile.customAnnualAmountKrw != null,
    billingStartDate: ymdFromIso(detail.profile.billingStartDate ?? detail.tenant.serviceStartedAt),
    autoIssueEnabled: detail.profile.autoIssueEnabled,
    contractMemo: detail.profile.contractMemo ?? '',
  };
}

export function PlatformTenantBillingPanel({ tenantId, compact }: Props) {
  const [detail, setDetail] = useState<PlatformTenantBillingDetail | null>(null);
  const [contractForm, setContractForm] = useState<ContractForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const d = await getPlatformTenantBilling(token, tenantId);
      setDetail(d);
      setContractForm(contractFormFromDetail(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const planId = (contractForm?.plan ?? detail?.tenant.plan ?? 'standard') as TenantPlanId;

  const autoAnnualPreview = useMemo(() => {
    if (!contractForm) return 0;
    const monthly = Number(contractForm.customMonthlyAmountKrw.replace(/,/g, ''));
    if (!Number.isFinite(monthly) || monthly <= 0) return 0;
    return calculateAnnualFromMonthlyKrw(monthly);
  }, [contractForm]);

  const onSaveContract = async () => {
    const token = getPlatformToken();
    if (!token || !contractForm) return;
    let customMonthly: number | null = null;
    let customAnnual: number | null = null;
    if (contractForm.pricingMode === 'CUSTOM') {
      const m = Number(contractForm.customMonthlyAmountKrw.replace(/,/g, ''));
      if (!Number.isFinite(m) || m < 0) {
        setError('약정 월 금액을 입력해 주세요.');
        return;
      }
      customMonthly = Math.trunc(m);
      if (contractForm.billingCycle === 'ANNUAL' && contractForm.useCustomAnnual && contractForm.customAnnualAmountKrw.trim()) {
        const a = Number(contractForm.customAnnualAmountKrw.replace(/,/g, ''));
        if (!Number.isFinite(a) || a < 0) {
          setError('약정 연 금액을 확인해 주세요.');
          return;
        }
        customAnnual = Math.trunc(a);
      }
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await patchPlatformTenantBillingProfile(token, tenantId, {
        plan: contractForm.plan,
        billingCycle: contractForm.billingCycle,
        pricingMode: contractForm.pricingMode,
        customMonthlyAmountKrw: contractForm.pricingMode === 'CUSTOM' ? customMonthly : null,
        customAnnualAmountKrw:
          contractForm.pricingMode === 'CUSTOM' &&
          contractForm.billingCycle === 'ANNUAL' &&
          contractForm.useCustomAnnual
            ? customAnnual
            : null,
        billingStartDate: contractForm.billingStartDate.trim() || null,
        autoIssueEnabled: contractForm.autoIssueEnabled,
        contractMemo: contractForm.contractMemo.trim() || null,
      });
      setMessage('계약 조건이 저장되었습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const onPrepaidConfirm = async () => {
    if (!window.confirm('입금을 확인하시겠습니까? 확인 후 7일 체험이 시작되고, 체험 종료일부터 매월 같은 날이 결제일입니다.')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await confirmPlatformPrepaid(token, tenantId);
      setMessage(result.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!detail || !contractForm) {
    return <PlatformAlert variant="error" message={error || '데이터를 불러올 수 없습니다.'} />;
  }

  const { tenant, profile, summary } = detail;

  const billingAnchorLabel =
    formatBillingAnchorDayLabel(summary.billingStartDate ?? tenant.serviceStartedAt) ??
    (tenant.trialEndsAt && tenant.prepaidConfirmedAt
      ? formatBillingAnchorDayLabel(tenant.trialEndsAt)
      : null);

  const showPrepaidConfirm = !tenant.prepaidConfirmedAt && !tenant.serviceStartedAt;

  return (
    <div className="space-y-4">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center gap-2">
          {!compact ? (
            <>
              <h2 className="text-base font-semibold text-gray-900">{tenant.name}</h2>
              <PlanBadge plan={tenant.plan} />
            </>
          ) : null}
          <StatusBadge status={tenant.status} />
          <BillingOperationalBadge
            code={summary.operationalStatus.code}
            label={summary.operationalStatus.label}
            detail={summary.operationalStatus.detail}
          />
        </div>
        {tenant.status === 'TRIAL' && tenant.trialEndsAt ? (
          <p className="mt-2 text-xs text-gray-500">
            체험 종료: {formatKoDate(tenant.trialEndsAt)}
            {tenant.prepaidConfirmedAt ? ' · 선입금 완료, 종료 후 정식 이용 시작' : ''}
          </p>
        ) : null}
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-gray-500">서비스 시작</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDate(tenant.serviceStartedAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">과금 시작</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDate(summary.billingStartDate)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">다음 납부일</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {summary.nextDueDate
                ? formatNextDueDateLabel(profile.billingCycle, summary.nextDueDate)
                : '—'}
              {summary.nextDueAmountKrw != null ? (
                <span className="ml-2 tabular-nums text-gray-700">
                  {summary.nextDueAmountKrw.toLocaleString('ko-KR')}원
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">결제일</dt>
            <dd className="mt-0.5 text-gray-900">
              {billingAnchorLabel ?? '과금 시작일 확정 후 매월 같은 날'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">약정 금액</dt>
            <dd className="mt-0.5 text-gray-900">{summary.amountLabel}</dd>
          </div>
          <div>
            <dt className="text-gray-500">자동 청구</dt>
            <dd className="mt-0.5 text-gray-900">{profile.autoIssueEnabled ? 'ON' : 'OFF'}</dd>
          </div>
        </dl>
      </section>

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">입금 · 체험</h3>
        <p className="text-xs text-gray-500">
          이용료를 받은 뒤 「입금 확인」을 누르면 7일 체험이 시작됩니다. 체험 종료일이 과금 시작일이며, 이후
          매월 그날이 결제일입니다.
        </p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">입금 확인</dt>
            <dd className="mt-0.5 text-gray-900">
              {tenant.prepaidConfirmedAt ? formatKoDate(tenant.prepaidConfirmedAt) : '미확인'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">체험 종료</dt>
            <dd className="mt-0.5 text-gray-900">
              {tenant.trialEndsAt ? formatKoDate(tenant.trialEndsAt) : '입금 확인 후 7일'}
            </dd>
          </div>
        </dl>
        {showPrepaidConfirm ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onPrepaidConfirm()}
            className={`${BTN_PRIMARY} mt-3`}
          >
            입금 확인 (7일 체험 시작)
          </button>
        ) : null}
      </section>

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">계약 조건</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="text-xs text-gray-600">플랜</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {PLAN_OPTIONS.map((plan) => (
                <button
                  key={plan}
                  type="button"
                  disabled={saving}
                  onClick={() => setContractForm((f) => (f ? { ...f, plan } : f))}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm',
                    contractForm.plan === plan
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {TENANT_PLAN_PRESENTATIONS[plan].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {billingCyclePriceHint(planId, contractForm.billingCycle, {
                pricingMode: contractForm.pricingMode,
                customMonthlyAmountKrw:
                  contractForm.pricingMode === 'CUSTOM' && contractForm.customMonthlyAmountKrw
                    ? Number(contractForm.customMonthlyAmountKrw.replace(/,/g, ''))
                    : null,
              })}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-600">납부 주기</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['MONTHLY', 'ANNUAL'] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  disabled={saving}
                  onClick={() => setContractForm((f) => (f ? { ...f, billingCycle: cycle } : f))}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm',
                    contractForm.billingCycle === cycle
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {TENANT_BILLING_CYCLE_LABEL[cycle]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-600">금액 기준</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['CATALOG', 'CUSTOM'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={saving}
                  onClick={() => setContractForm((f) => (f ? { ...f, pricingMode: mode } : f))}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm',
                    contractForm.pricingMode === mode
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {TENANT_BILLING_PRICING_MODE_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>
          {contractForm.pricingMode === 'CUSTOM' ? (
            <>
              <label className="block text-sm">
                <span className="text-gray-600">약정 월 금액 (원)</span>
                <input
                  className={`mt-1 ${INPUT_BASE}`}
                  value={contractForm.customMonthlyAmountKrw}
                  onChange={(e) =>
                    setContractForm((f) => (f ? { ...f, customMonthlyAmountKrw: e.target.value } : f))
                  }
                />
                {Number(contractForm.customMonthlyAmountKrw.replace(/,/g, '')) === 0 ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    0원 약정 — 이용료·청구·미납 제한 없이 계속 이용 가능한 면제 업체로 처리됩니다.
                  </p>
                ) : null}
              </label>
              {contractForm.billingCycle === 'ANNUAL' ? (
                <label className="block text-sm">
                  <span className="text-gray-600">약정 연 금액 (원)</span>
                  <div className="mt-1 space-y-1">
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={contractForm.useCustomAnnual}
                        onChange={(e) =>
                          setContractForm((f) =>
                            f ? { ...f, useCustomAnnual: e.target.checked } : f,
                          )
                        }
                      />
                      직접 입력 (미체크 시 월×12×85% 자동)
                    </label>
                    <input
                      className={INPUT_BASE}
                      disabled={!contractForm.useCustomAnnual}
                      placeholder={
                        autoAnnualPreview > 0
                          ? `자동: ${autoAnnualPreview.toLocaleString('ko-KR')}원`
                          : undefined
                      }
                      value={contractForm.customAnnualAmountKrw}
                      onChange={(e) =>
                        setContractForm((f) => (f ? { ...f, customAnnualAmountKrw: e.target.value } : f))
                      }
                    />
                  </div>
                </label>
              ) : null}
            </>
          ) : null}
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">과금 시작일</span>
            <input
              type="date"
              className={`mt-1 ${INPUT_BASE}`}
              value={contractForm.billingStartDate}
              onChange={(e) =>
                setContractForm((f) => (f ? { ...f, billingStartDate: e.target.value } : f))
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              신규는 체험 종료일과 동일하게 자동 설정됩니다. 기존 업체만 수동 입력하세요. 시작일의
              「일」이 매월 결제일입니다.
            </p>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={contractForm.autoIssueEnabled}
              onChange={(e) =>
                setContractForm((f) => (f ? { ...f, autoIssueEnabled: e.target.checked } : f))
              }
            />
            <span className="text-gray-700">이용 기간 시작일에 청구서 자동 발행</span>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">내부 메모</span>
            <textarea
              rows={2}
              className={`mt-1 ${INPUT_BASE}`}
              value={contractForm.contractMemo}
              onChange={(e) =>
                setContractForm((f) => (f ? { ...f, contractMemo: e.target.value } : f))
              }
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={saving} onClick={() => void onSaveContract()} className={BTN_PRIMARY}>
            계약 조건 저장
          </button>
        </div>
      </section>

      <section className={CARD_SECTION}>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">청구 일정</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            면제·금액 변경·이월·청구 발행·입금완료·취소를 각 행에서 처리합니다. 입금완료는 발행 전에도 가능합니다.
          </p>
        </div>
        <PlatformTenantBillingScheduleSection
          tenantId={tenantId}
          onMutate={() => void load()}
          showPrepaidConfirm={showPrepaidConfirm}
        />
      </section>
    </div>
  );
}
