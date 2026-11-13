import { useEffect, useState } from 'react';
import { formatNextDueDateLabel } from '@shared/tenantBilling';
import { getPlatformTenantBilling, type PlatformTenantBillingDetail } from '../../api/platformBilling';
import { getPlatformTenantAlimtalkPolicy } from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';

function won(n: number) {
  return `${n.toLocaleString('ko-KR')}원`;
}

function ExemptChip() {
  return (
    <span className="ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-violet-700">
      면제
    </span>
  );
}

type Props = {
  tenantId: string;
  /** 값이 바뀌면 다시 불러온다 */
  refreshKey?: number;
};

/** 업체 상세 상단 — 월 이용료·부가 요금·다음 청구·지갑 잔액 한 줄 요약 */
export function PlatformTenantBillingSummaryStrip({ tenantId, refreshKey = 0 }: Props) {
  const [billing, setBilling] = useState<PlatformTenantBillingDetail | null>(null);
  const [walletKrw, setWalletKrw] = useState<number | null>(null);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    let cancelled = false;
    void getPlatformTenantBilling(token, tenantId)
      .then((d) => {
        if (!cancelled) setBilling(d);
      })
      .catch(() => undefined);
    void getPlatformTenantAlimtalkPolicy(token, tenantId)
      .then((p) => {
        if (!cancelled) setWalletKrw(p.prepaidBalanceKrw);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tenantId, refreshKey]);

  if (!billing) {
    return <div className="h-[86px] rounded-xl border border-gray-200 bg-white" aria-hidden />;
  }

  const { summary, profile } = billing;
  const exempt = summary.billingFeeExempt === true || profile.feeExempt === true;
  const addonExempt = exempt && summary.feeExemptAddons === true;
  const monthlyAddon = summary.monthlyAddonKrw ?? 0;
  const linkCount = summary.landingContactLinkCount ?? 0;
  const perCycle = profile.billingCycle === 'ANNUAL' ? '연' : '월';

  const cell = 'min-w-0 bg-white p-3.5';
  const label = 'text-xs text-gray-500';
  const value = 'mt-1 truncate text-[17px] font-bold tabular-nums text-gray-900';
  const sub = 'mt-0.5 truncate text-[11.5px] text-gray-400';

  return (
    <section
      aria-label="요금 요약"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-100 sm:grid-cols-4"
    >
      <div className={cell}>
        <p className={label}>{perCycle} 이용료</p>
        <p className={value}>
          {exempt ? '0원' : won(summary.amountKrw)}
          {exempt ? <ExemptChip /> : null}
        </p>
        <p className={sub}>
          {profile.pricingMode === 'CUSTOM' && !exempt ? '약정 금액 · ' : ''}표준 월 {won(summary.catalogMonthlyAmountKrw)}
        </p>
      </div>
      <div className={cell}>
        <p className={label}>부가 요금</p>
        <p className={value}>
          {monthlyAddon <= 0 ? '없음' : addonExempt ? '0원' : won(monthlyAddon)}
          {monthlyAddon > 0 && addonExempt ? <ExemptChip /> : null}
          {monthlyAddon > 0 && !addonExempt ? (
            <span className="text-xs font-medium text-gray-400"> /월</span>
          ) : null}
        </p>
        <p className={sub}>
          {monthlyAddon > 0 ? `랜딩 문의 링크 ${linkCount}개 · 월 ${won(monthlyAddon)}` : '랜딩 문의 링크 없음'}
        </p>
      </div>
      <div className={cell}>
        <p className={label}>다음 청구</p>
        <p className={value}>
          {summary.nextDueDate && (summary.nextDueAmountKrw ?? 0) > 0
            ? formatNextDueDateLabel(profile.billingCycle, summary.nextDueDate)
            : '없음'}
        </p>
        <p className={sub}>
          {summary.nextDueDate && (summary.nextDueAmountKrw ?? 0) > 0
            ? `${won(summary.nextDueAmountKrw ?? 0)} · ${profile.autoIssueEnabled ? '자동 발행' : '직접 발행'}`
            : exempt
              ? '면제 업체라 청구하지 않아요'
              : '과금 시작일 설정 전'}
        </p>
      </div>
      <div className={cell}>
        <p className={label}>지갑 잔액</p>
        <p className={value}>{walletKrw == null ? '—' : won(walletKrw)}</p>
        <p className={sub}>알림톡·계산서 공용</p>
      </div>
    </section>
  );
}
