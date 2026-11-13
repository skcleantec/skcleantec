import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateAnnualFromMonthlyKrw,
  calculateBillingAmountKrw,
  formatBillingAnchorDayLabel,
  TENANT_BILLING_CYCLE_LABEL,
  type TenantBillingCycle,
} from '@shared/tenantBilling';
import type { TenantPlanId } from '@shared/tenantFeatureModules';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import { normalizePlanId } from '@shared/tenantPlanNormalize';
import {
  confirmPlatformPrepaid,
  getPlatformTenantBilling,
  patchPlatformTenantBillingProfile,
  type PlatformTenantBillingDetail,
} from '../../api/platformBilling';
import { resetPlatformTenantFeaturesFromPlan } from '../../api/platformTenants';
import { PlatformTenantBillingScheduleSection } from './PlatformTenantBillingScheduleSection';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE, PlatformAlert } from '../../utils/platformUi';

function formatKoDay(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function ymdFromIso(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

type Props = {
  tenantId: string;
  compact?: boolean;
  /** 플랜·면제 등 업체 정보가 바뀌었을 때 (상위 화면 새로고침용) */
  onTenantChanged?: () => void;
};

const PLAN_OPTIONS: TenantPlanId[] = ['free', 'standard', 'standard_plus', 'premium'];

/** 이용료 방식 — 표준 / 약정 / 면제 */
type FeeMode = 'CATALOG' | 'CUSTOM' | 'EXEMPT';

const FEE_MODE_LABEL: Record<FeeMode, string> = {
  CATALOG: '표준',
  CUSTOM: '약정',
  EXEMPT: '면제',
};

type ContractForm = {
  plan: TenantPlanId;
  billingCycle: TenantBillingCycle;
  feeMode: FeeMode;
  feeExemptAddons: boolean;
  customMonthlyAmountKrw: string;
  customAnnualAmountKrw: string;
  useCustomAnnual: boolean;
  billingStartDate: string;
  billingDueDay: string;
  autoIssueEnabled: boolean;
  contractMemo: string;
};

function feeModeFromDetail(detail: PlatformTenantBillingDetail): FeeMode {
  if (detail.profile.feeExempt || detail.summary.billingFeeExempt) return 'EXEMPT';
  return detail.profile.pricingMode === 'CUSTOM' ? 'CUSTOM' : 'CATALOG';
}

function contractFormFromDetail(detail: PlatformTenantBillingDetail): ContractForm {
  const feeMode = feeModeFromDetail(detail);
  return {
    plan: normalizePlanId(detail.tenant.plan),
    billingCycle: detail.profile.billingCycle,
    feeMode,
    feeExemptAddons: detail.profile.feeExemptAddons === true,
    customMonthlyAmountKrw:
      feeMode === 'CUSTOM' && detail.profile.customMonthlyAmountKrw != null
        ? String(detail.profile.customMonthlyAmountKrw)
        : '',
    customAnnualAmountKrw:
      detail.profile.customAnnualAmountKrw != null ? String(detail.profile.customAnnualAmountKrw) : '',
    useCustomAnnual: detail.profile.customAnnualAmountKrw != null,
    billingStartDate: ymdFromIso(detail.profile.billingStartDate ?? detail.tenant.serviceStartedAt),
    billingDueDay: String(detail.profile.billingDueDay ?? 25),
    autoIssueEnabled: detail.profile.autoIssueEnabled,
    contractMemo: detail.profile.contractMemo ?? '',
  };
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg bg-gray-100 p-1 text-sm font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PlatformTenantBillingPanel({ tenantId, onTenantChanged }: Props) {
  const [detail, setDetail] = useState<PlatformTenantBillingDetail | null>(null);
  const [form, setForm] = useState<ContractForm | null>(null);
  const [editing, setEditing] = useState(false);
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
      setForm(contractFormFromDetail(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchForm = (patch: Partial<ContractForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const autoAnnualPreview = useMemo(() => {
    if (!form) return 0;
    const monthly = Number(form.customMonthlyAmountKrw.replace(/,/g, ''));
    if (!Number.isFinite(monthly) || monthly <= 0) return 0;
    return calculateAnnualFromMonthlyKrw(monthly);
  }, [form]);

  const startEdit = () => {
    if (detail) setForm(contractFormFromDetail(detail));
    setMessage('');
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    if (detail) setForm(contractFormFromDetail(detail));
    setEditing(false);
  };

  const onSaveContract = async () => {
    const token = getPlatformToken();
    if (!token || !form || !detail) return;
    let customMonthly: number | null = null;
    let customAnnual: number | null = null;
    if (form.feeMode === 'CUSTOM') {
      const m = Number(form.customMonthlyAmountKrw.replace(/,/g, ''));
      if (!Number.isFinite(m) || m < 1) {
        setError('약정 월 금액은 1원 이상이에요. 이용료를 받지 않으려면 「면제」를 골라 주세요.');
        return;
      }
      customMonthly = Math.trunc(m);
      if (form.billingCycle === 'ANNUAL' && form.useCustomAnnual && form.customAnnualAmountKrw.trim()) {
        const a = Number(form.customAnnualAmountKrw.replace(/,/g, ''));
        if (!Number.isFinite(a) || a < 1) {
          setError('약정 연 금액을 확인해 주세요.');
          return;
        }
        customAnnual = Math.trunc(a);
      }
    }
    const dueDay = Number(form.billingDueDay);
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28) {
      setError('결제일은 1~28일 중에서 골라 주세요.');
      return;
    }
    const planChanged = form.plan !== normalizePlanId(detail.tenant.plan);
    if (
      planChanged &&
      !window.confirm(
        `플랜을 ${TENANT_PLAN_PRESENTATIONS[form.plan].label}(으)로 바꾸면 기능이 플랜 기본값으로 다시 맞춰져요. 저장할까요?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await patchPlatformTenantBillingProfile(token, tenantId, {
        plan: form.plan,
        billingCycle: form.billingCycle,
        pricingMode: form.feeMode === 'CUSTOM' ? 'CUSTOM' : 'CATALOG',
        customMonthlyAmountKrw: form.feeMode === 'CUSTOM' ? customMonthly : null,
        customAnnualAmountKrw:
          form.feeMode === 'CUSTOM' && form.billingCycle === 'ANNUAL' && form.useCustomAnnual ? customAnnual : null,
        feeExempt: form.feeMode === 'EXEMPT',
        feeExemptAddons: form.feeMode === 'EXEMPT' && form.feeExemptAddons,
        billingDueDay: Math.trunc(dueDay),
        billingStartDate: form.billingStartDate.trim() || null,
        autoIssueEnabled: form.autoIssueEnabled,
        contractMemo: form.contractMemo.trim() || null,
      });
      if (planChanged) await resetPlatformTenantFeaturesFromPlan(token, tenantId);
      setMessage('계약을 저장했어요.');
      setEditing(false);
      await load();
      onTenantChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const onPrepaidConfirm = async () => {
    if (
      !window.confirm(
        '가입 체험 이벤트가 켜져 있을 때만 무료 체험이 시작돼요. 체험이 끝나는 날부터 과금이 시작돼요. 진행할까요?',
      )
    )
      return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await confirmPlatformPrepaid(token, tenantId);
      setMessage(result.message);
      await load();
      onTenantChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !detail) {
    return <div className="p-6 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!detail || !form) {
    return <PlatformAlert variant="error" message={error || '데이터를 불러올 수 없습니다.'} />;
  }

  const { tenant, profile, summary } = detail;
  const planId = normalizePlanId(tenant.plan);
  const exempt = summary.billingFeeExempt === true || profile.feeExempt === true;
  const addonExempt = exempt && (summary.feeExemptAddons === true || profile.feeExemptAddons === true);
  const monthlyAddon = summary.monthlyAddonKrw ?? 0;
  const linkCount = summary.landingContactLinkCount ?? 0;
  const cycleLabel = TENANT_BILLING_CYCLE_LABEL[profile.billingCycle];
  const perCycle = profile.billingCycle === 'ANNUAL' ? '연' : '월';
  const addonPerCycle = profile.billingCycle === 'ANNUAL' ? monthlyAddon * 12 : monthlyAddon;
  const baseAmount = exempt ? 0 : summary.amountKrw;
  const addonAmount = addonExempt ? 0 : addonPerCycle;

  const feeLabel = exempt
    ? '면제'
    : profile.pricingMode === 'CUSTOM'
      ? `약정 ${won(summary.amountKrw)}`
      : `표준 ${won(summary.amountKrw)}`;
  const anchorLabel =
    formatBillingAnchorDayLabel(summary.billingStartDate ?? tenant.serviceStartedAt) ??
    `매월 ${profile.billingDueDay}일`;

  const showTrial = tenant.status === 'TRIAL' || (!tenant.prepaidConfirmedAt && !tenant.serviceStartedAt);
  const showPrepaidConfirm = !tenant.prepaidConfirmedAt && !tenant.serviceStartedAt;
  const formPlanCatalog = calculateBillingAmountKrw(form.plan, 'MONTHLY');

  return (
    <div className="space-y-5">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      {showTrial ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-amber-900">체험 중</p>
            <p className="mt-0.5 text-xs text-amber-800">
              {tenant.trialEndsAt
                ? `체험 종료 ${formatKoDay(tenant.trialEndsAt)} · 종료일부터 과금이 시작돼요.`
                : '체험 시작 전이에요. 가입 체험 이벤트가 켜져 있을 때만 시작할 수 있어요.'}
            </p>
          </div>
          {showPrepaidConfirm ? (
            <button type="button" disabled={saving} onClick={() => void onPrepaidConfirm()} className={BTN_PRIMARY}>
              체험 시작
            </button>
          ) : null}
        </section>
      ) : null}

      <section id="section-plan" className="scroll-mt-24 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">계약</h2>
          {!editing ? (
            <button type="button" onClick={startEdit} className={`${BTN_SECONDARY} px-3 py-1.5 text-sm`}>
              수정
            </button>
          ) : null}
        </div>

        {!editing ? (
          <div className="grid gap-x-8 gap-y-4 px-5 py-5 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">플랜</p>
              <p className="mt-1 font-semibold text-gray-900">
                {TENANT_PLAN_PRESENTATIONS[planId].label} · {cycleLabel}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">이용료</p>
              <p className={`mt-1 font-semibold ${exempt ? 'text-violet-700' : 'text-gray-900'}`}>{feeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">결제일</p>
              <p className="mt-1 font-semibold text-gray-900">{anchorLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">서비스 시작</p>
              <p className="mt-1 font-semibold tabular-nums text-gray-900">{formatKoDay(tenant.serviceStartedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">과금 시작</p>
              <p className="mt-1 font-semibold tabular-nums text-gray-900">{formatKoDay(summary.billingStartDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{exempt ? '면제 범위' : '청구서 자동 발행'}</p>
              <p className="mt-1 font-semibold text-gray-900">
                {exempt
                  ? addonExempt
                    ? '이용료 + 부가 요금'
                    : '이용료만'
                  : profile.autoIssueEnabled
                    ? '켜짐'
                    : '꺼짐'}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3.5 py-3 text-[13px] text-gray-600 sm:col-span-3">
              {perCycle} 청구 금액 = 이용료{' '}
              <b className="tabular-nums text-gray-900">{exempt ? '0원(면제)' : won(baseAmount)}</b>
              {monthlyAddon > 0 ? (
                <>
                  {' '}
                  + 랜딩 문의 링크 {linkCount}개{' '}
                  <b className="tabular-nums text-gray-900">{addonExempt ? '0원(면제)' : won(addonAmount)}</b>
                </>
              ) : null}{' '}
              = <b className="tabular-nums text-gray-900">{won(baseAmount + addonAmount)}</b>
              {!exempt ? <span className="text-gray-400"> (VAT 별도)</span> : null}
            </div>
            {profile.contractMemo ? (
              <p className="whitespace-pre-wrap text-xs text-gray-500 sm:col-span-3">메모 · {profile.contractMemo}</p>
            ) : null}
          </div>
        ) : (
          <form
            className="grid gap-5 px-5 py-5 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void onSaveContract();
            }}
          >
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-700">플랜</p>
              <Segmented
                label="플랜"
                value={form.plan}
                disabled={saving}
                onChange={(plan) => patchForm({ plan })}
                options={PLAN_OPTIONS.map((p) => ({ value: p, label: TENANT_PLAN_PRESENTATIONS[p].label }))}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                표준 월 {won(formPlanCatalog)} (VAT 별도)
                {form.plan !== planId ? ' · 저장하면 기능이 플랜 기본값으로 다시 맞춰져요.' : ''}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-700">납부 주기</p>
                <Segmented
                  label="납부 주기"
                  value={form.billingCycle}
                  disabled={saving}
                  onChange={(billingCycle) => patchForm({ billingCycle })}
                  options={(['MONTHLY', 'ANNUAL'] as const).map((c) => ({
                    value: c,
                    label: TENANT_BILLING_CYCLE_LABEL[c],
                  }))}
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-700">이용료</p>
                <Segmented
                  label="이용료"
                  value={form.feeMode}
                  disabled={saving}
                  onChange={(feeMode) => patchForm({ feeMode })}
                  options={(['CATALOG', 'CUSTOM', 'EXEMPT'] as const).map((m) => ({
                    value: m,
                    label: FEE_MODE_LABEL[m],
                  }))}
                />
                {form.feeMode === 'EXEMPT' ? (
                  <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-700">면제 범위</p>
                    <label className="flex items-center gap-2 text-gray-400">
                      <input type="checkbox" checked disabled className="h-4 w-4 accent-gray-900" />
                      월 이용료
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.feeExemptAddons}
                        onChange={(e) => patchForm({ feeExemptAddons: e.target.checked })}
                        className="h-4 w-4 accent-gray-900"
                      />
                      부가 요금
                      <span className="text-gray-400">
                        (랜딩 문의 링크{monthlyAddon > 0 ? ` 월 ${won(monthlyAddon)}` : ''})
                      </span>
                    </label>
                    <p className="text-xs text-gray-500">
                      면제 업체는 미납 처리·접속 제한이 없어요. 면제한 금액은 청구서에 들어가지 않아요.
                    </p>
                  </div>
                ) : null}
              </div>

              {form.feeMode === 'CUSTOM' ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-700">약정 월 금액</span>
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      className={`${INPUT_BASE} pr-8 tabular-nums`}
                      value={form.customMonthlyAmountKrw}
                      onChange={(e) => patchForm({ customMonthlyAmountKrw: e.target.value })}
                      placeholder="예: 150000"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">원</span>
                  </div>
                </label>
              ) : null}

              {form.feeMode === 'CUSTOM' && form.billingCycle === 'ANNUAL' ? (
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-gray-700">약정 연 금액</span>
                  <label className="mb-1.5 flex items-center gap-2 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={form.useCustomAnnual}
                      onChange={(e) => patchForm({ useCustomAnnual: e.target.checked })}
                    />
                    직접 입력 (안 하면 월 금액 × 12 × 85%)
                  </label>
                  <input
                    className={`${INPUT_BASE} tabular-nums`}
                    disabled={!form.useCustomAnnual}
                    placeholder={autoAnnualPreview > 0 ? `자동: ${won(autoAnnualPreview)}` : undefined}
                    value={form.customAnnualAmountKrw}
                    onChange={(e) => patchForm({ customAnnualAmountKrw: e.target.value })}
                  />
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-700">과금 시작일</span>
                <input
                  type="date"
                  className={`${INPUT_BASE} tabular-nums`}
                  value={form.billingStartDate}
                  onChange={(e) => patchForm({ billingStartDate: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-700">결제일</span>
                <select
                  className={INPUT_BASE}
                  value={form.billingDueDay}
                  onChange={(e) => patchForm({ billingDueDay: e.target.value })}
                >
                  {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                    <option key={d} value={d}>
                      매월 {d}일
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5 text-gray-700">
                <input
                  type="checkbox"
                  checked={form.autoIssueEnabled}
                  onChange={(e) => patchForm({ autoIssueEnabled: e.target.checked })}
                  className="h-4 w-4 accent-gray-900"
                />
                이용 기간 시작일에 청구서 자동 발행
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-700">내부 메모</span>
              <textarea
                rows={2}
                className={INPUT_BASE}
                value={form.contractMemo}
                onChange={(e) => patchForm({ contractMemo: e.target.value })}
              />
            </label>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" disabled={saving} onClick={cancelEdit} className={BTN_SECONDARY}>
                취소
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        )}
      </section>

      <PlatformTenantBillingScheduleSection
        tenantId={tenantId}
        voidInvoices={detail.invoices.filter((i) => i.status === 'VOID')}
        onMutate={() => {
          void load();
          onTenantChanged?.();
        }}
      />
    </div>
  );
}
