import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateAnnualFromMonthlyKrw,
  formatNextDueDateLabel,
  needsLegacyPrepaidConfirm,
  TENANT_BILLING_ADJUSTMENT_TYPE_LABEL,
  TENANT_BILLING_CYCLE_LABEL,
  TENANT_BILLING_PRICING_MODE_LABEL,
  TENANT_BILLING_SCHEDULE_STATUS_LABEL,
  TENANT_INVOICE_STATUS_LABEL,
  billingCyclePriceHint,
  type TenantBillingAdjustmentType,
  type TenantBillingCycle,
  type TenantBillingPricingMode,
} from '@shared/tenantBilling';
import type { TenantPlanId } from '@shared/tenantFeatureModules';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import {
  confirmPlatformInvoicePayment,
  confirmPlatformPrepaid,
  createPlatformBillingAdjustment,
  getPlatformTenantBilling,
  issuePlatformTenantInvoice,
  patchPlatformTenantBillingProfile,
  voidPlatformBillingAdjustment,
  type PlatformTenantBillingDetail,
} from '../../api/platformBilling';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
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

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
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
  billingDueDay: string;
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
    billingDueDay: String(detail.profile.billingDueDay),
    billingStartDate: ymdFromIso(detail.profile.billingStartDate ?? detail.tenant.serviceStartedAt),
    autoIssueEnabled: detail.profile.autoIssueEnabled,
    contractMemo: detail.profile.contractMemo ?? '',
  };
}

function scheduleStatusClass(status: string) {
  if (status === 'PAID') return 'text-emerald-700 bg-emerald-50';
  if (status === 'OVERDUE') return 'text-rose-700 bg-rose-50';
  if (status === 'ISSUED') return 'text-amber-800 bg-amber-50';
  if (status === 'SCHEDULED') return 'text-slate-600 bg-slate-50';
  if (status === 'SKIPPED' || status === 'DEFERRED') return 'text-violet-700 bg-violet-50';
  return 'text-gray-600 bg-gray-50';
}

export function PlatformTenantBillingPanel({ tenantId, compact }: Props) {
  const [detail, setDetail] = useState<PlatformTenantBillingDetail | null>(null);
  const [contractForm, setContractForm] = useState<ContractForm | null>(null);
  const [adjType, setAdjType] = useState<TenantBillingAdjustmentType>('SKIP');
  const [adjTargetDate, setAdjTargetDate] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
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
    const dueDay = Number.parseInt(contractForm.billingDueDay, 10);
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28) {
      setError('납부 기준일은 1~28 사이여야 합니다.');
      return;
    }
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
        billingDueDay: dueDay,
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
    if (!window.confirm('사용료 수령을 확인하시겠습니까? 7일 후 서비스가 시작됩니다.')) return;
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

  const onIssueInvoice = async () => {
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await issuePlatformTenantInvoice(token, tenantId);
      setMessage('청구서가 발행되었습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '발행 실패');
    } finally {
      setSaving(false);
    }
  };

  const onConfirmPayment = async (invoiceId: string) => {
    if (!window.confirm('납부 확인 처리하시겠습니까?')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await confirmPlatformInvoicePayment(token, invoiceId);
      setMessage('납부 확인되었습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 실패');
    } finally {
      setSaving(false);
    }
  };

  const onAddAdjustment = async () => {
    const token = getPlatformToken();
    if (!token) return;
    if (!adjTargetDate.trim() || !adjReason.trim()) {
      setError('대상 기간 시작일과 사유를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await createPlatformBillingAdjustment(token, tenantId, {
        type: adjType,
        targetPeriodStart: adjTargetDate.trim(),
        reason: adjReason.trim(),
        customAmountKrw:
          adjType === 'CUSTOM_AMOUNT' ? Number(adjAmount.replace(/,/g, '')) : undefined,
      });
      setMessage('예외가 등록되었습니다.');
      setAdjReason('');
      setAdjAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setSaving(false);
    }
  };

  const onVoidAdjustment = async (adjustmentId: string) => {
    if (!window.confirm('이 예외를 취소하시겠습니까?')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    try {
      await voidPlatformBillingAdjustment(token, tenantId, adjustmentId);
      setMessage('예외가 취소되었습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소 실패');
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

  const { tenant, profile, summary, invoices, schedule, adjustments } = detail;

  const showLegacyPrepaid =
    needsLegacyPrepaidConfirm({
      prepaidConfirmedAt: tenant.prepaidConfirmedAt,
      serviceStartedAt: tenant.serviceStartedAt,
      createdAt: tenant.createdAt,
    }) && (tenant.status === 'TRIAL' || tenant.status === 'SUSPENDED');

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
            <dt className="text-gray-500">납부 기준일</dt>
            <dd className="mt-0.5 text-gray-900">매월 {profile.billingDueDay}일</dd>
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
          <label className="block text-sm">
            <span className="text-gray-600">납부 기준일 (매월)</span>
            <input
              type="number"
              min={1}
              max={28}
              className={`mt-1 ${INPUT_BASE}`}
              value={contractForm.billingDueDay}
              onChange={(e) =>
                setContractForm((f) => (f ? { ...f, billingDueDay: e.target.value } : f))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">과금 시작일</span>
            <input
              type="date"
              className={`mt-1 ${INPUT_BASE}`}
              value={contractForm.billingStartDate}
              onChange={(e) =>
                setContractForm((f) => (f ? { ...f, billingStartDate: e.target.value } : f))
              }
            />
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
        <h3 className="text-sm font-semibold text-gray-900">예외 · 이월</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-gray-600">유형</span>
            <select
              className={`mt-1 ${INPUT_BASE}`}
              value={adjType}
              onChange={(e) => setAdjType(e.target.value as TenantBillingAdjustmentType)}
            >
              {(Object.keys(TENANT_BILLING_ADJUSTMENT_TYPE_LABEL) as TenantBillingAdjustmentType[]).map(
                (t) => (
                  <option key={t} value={t}>
                    {TENANT_BILLING_ADJUSTMENT_TYPE_LABEL[t]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">대상 기간 시작일</span>
            <input
              type="date"
              className={`mt-1 ${INPUT_BASE}`}
              value={adjTargetDate}
              onChange={(e) => setAdjTargetDate(e.target.value)}
            />
          </label>
          {adjType === 'CUSTOM_AMOUNT' ? (
            <label className="block text-sm">
              <span className="text-gray-600">1회 금액 (원)</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-gray-600">사유</span>
            <input
              className={`mt-1 ${INPUT_BASE}`}
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={saving} onClick={() => void onAddAdjustment()} className={BTN_SECONDARY}>
            예외 등록
          </button>
        </div>
        {adjustments.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 text-center font-medium">대상일</th>
                  <th className="py-2 text-center font-medium">유형</th>
                  <th className="py-2 text-center font-medium">금액</th>
                  <th className="py-2 text-center font-medium">사유</th>
                  <th className="py-2 text-center font-medium">취소</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 text-center text-xs">{formatYmd(a.targetPeriodStart)}</td>
                    <td className="py-2 text-center text-xs">
                      {TENANT_BILLING_ADJUSTMENT_TYPE_LABEL[a.type]}
                    </td>
                    <td className="py-2 text-center tabular-nums">
                      {a.customAmountKrw != null ? `${a.customAmountKrw.toLocaleString('ko-KR')}원` : '—'}
                    </td>
                    <td className="py-2 text-center text-xs truncate max-w-[160px]" title={a.reason}>
                      {a.reason}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        type="button"
                        className="text-xs text-rose-600 hover:underline"
                        onClick={() => void onVoidAdjustment(a.id)}
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500">등록된 예외가 없습니다.</p>
        )}
      </section>

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">청구 일정</h3>
        {schedule.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">과금 시작일 설정 후 일정이 표시됩니다.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 text-center font-medium">이용 기간</th>
                  <th className="py-2 text-center font-medium">납부일</th>
                  <th className="py-2 text-center font-medium">금액</th>
                  <th className="py-2 text-center font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {schedule.slice(0, 18).map((row) => (
                  <tr key={`${row.periodStart}-${row.status}`} className="border-b border-gray-100">
                    <td className="py-2 text-center text-xs">
                      {formatYmd(row.periodStart)} ~ {formatYmd(row.periodEnd)}
                    </td>
                    <td className="py-2 text-center text-xs">{formatYmd(row.dueDate)}</td>
                    <td className="py-2 text-center tabular-nums">
                      {row.amountKrw > 0 ? `${row.amountKrw.toLocaleString('ko-KR')}원` : '—'}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs ${scheduleStatusClass(row.status)}`}
                      >
                        {TENANT_BILLING_SCHEDULE_STATUS_LABEL[row.status] ??
                          TENANT_INVOICE_STATUS_LABEL[row.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ??
                          row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">플랫폼 작업</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {!showLegacyPrepaid ? null : (
            <button type="button" disabled={saving} onClick={() => void onPrepaidConfirm()} className={BTN_PRIMARY}>
              사용료 수령 확인 (레거시)
            </button>
          )}
          {tenant.serviceStartedAt ? (
            <button type="button" disabled={saving} onClick={() => void onIssueInvoice()} className={BTN_SECONDARY}>
              수동 청구서 발행
            </button>
          ) : null}
          <button type="button" disabled={saving} onClick={() => void load()} className={BTN_SECONDARY}>
            새로고침
          </button>
        </div>
      </section>

      {(summary.overdueInvoice || summary.openInvoice) && (
        <section className={CARD_SECTION}>
          <h3 className="text-sm font-semibold text-gray-900">미납 · 청구 중</h3>
          <div className="mt-2 space-y-2">
            {[summary.overdueInvoice, summary.openInvoice].filter(Boolean).map((inv) =>
              inv ? (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{inv.amountKrw.toLocaleString('ko-KR')}원</span>
                    <span className="ml-2 text-gray-500">
                      {formatYmd(inv.periodStart)} ~ {formatYmd(inv.periodEnd)}
                    </span>
                  </div>
                  {inv.status !== 'PAID' ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void onConfirmPayment(inv.id)}
                      className={BTN_PRIMARY}
                    >
                      납부 확인
                    </button>
                  ) : null}
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">청구서 이력</h3>
        {invoices.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">청구서가 없습니다.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 text-center font-medium">기간</th>
                  <th className="py-2 text-center font-medium">금액</th>
                  <th className="py-2 text-center font-medium">납부기한</th>
                  <th className="py-2 text-center font-medium">상태</th>
                  <th className="py-2 text-center font-medium">발행</th>
                  <th className="py-2 text-center font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-2 text-center text-xs">
                      {formatYmd(inv.periodStart)} ~ {formatYmd(inv.periodEnd)}
                    </td>
                    <td className="py-2 text-center tabular-nums">{inv.amountKrw.toLocaleString('ko-KR')}원</td>
                    <td className="py-2 text-center text-xs">{formatYmd(inv.dueDate)}</td>
                    <td className="py-2 text-center">{TENANT_INVOICE_STATUS_LABEL[inv.status]}</td>
                    <td className="py-2 text-center text-xs">{inv.source === 'AUTO' ? '자동' : '수동'}</td>
                    <td className="py-2 text-center">
                      {inv.status === 'ISSUED' || inv.status === 'OVERDUE' ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void onConfirmPayment(inv.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          납부 확인
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
