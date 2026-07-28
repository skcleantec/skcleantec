import { Link } from 'react-router-dom';
import type { TenantSubscriptionDto } from '../../api/tenantSubscription';
import {
  gaugeFillPercent,
  resolveCoinUsage,
  TENANT_SUBSCRIPTION_ADMIN_PATH,
  usageWarnLevel,
} from '../../utils/tenantUsageDisplay';
import { TenantUsageGauge } from './TenantUsageGauge';

type Props = {
  data: TenantSubscriptionDto;
  /** compact: 한 줄 배너(발주서 등). full: 게이지 포함 */
  variant?: 'compact' | 'full';
  showDetailLink?: boolean;
  className?: string;
};

export function TenantCoinUsageBanner({
  data,
  variant = 'compact',
  showDetailLink = true,
  className = '',
}: Props) {
  const coin = resolveCoinUsage(data);
  const fillPercent = coin.unlimited ? null : gaugeFillPercent(coin.used, coin.limit);
  const level = usageWarnLevel(coin.used, coin.unlimited ? null : coin.limit);

  const tone =
    level === 'over'
      ? 'border-rose-200 bg-rose-50 text-rose-950'
      : level === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : 'border-indigo-200 bg-indigo-50/80 text-slate-900';

  if (variant === 'full') {
    return (
      <div className={`rounded-xl border p-3 sm:p-4 ${tone} ${className}`}>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-6">
          <TenantUsageGauge
            used={coin.used}
            limit={coin.limit}
            unit={coin.unit}
            label={coin.label}
            unlimited={coin.unlimited}
          />
          <div className="min-w-0 flex-1 space-y-2 text-fluid-xs sm:text-fluid-sm">
            <p className="font-semibold">{coin.label} (이번 달)</p>
            {coin.unlimited ? (
              <p>포함 코인이 무제한입니다.</p>
            ) : (
              <>
                <p className="tabular-nums">
                  {coin.used.toLocaleString()} / {coin.limit?.toLocaleString() ?? '0'}
                  {coin.unit} 사용
                  {coin.remaining != null ? ` · 잔여 ${coin.remaining.toLocaleString()}${coin.unit}` : ''}
                </p>
                {fillPercent != null ? (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div
                      className={[
                        'h-full rounded-full',
                        level === 'over' ? 'bg-rose-500' : level === 'warn' ? 'bg-amber-500' : 'bg-indigo-600',
                      ].join(' ')}
                      style={{ width: `${Math.min(100, fillPercent)}%` }}
                    />
                  </div>
                ) : null}
              </>
            )}
            <p className="text-[11px] opacity-80">
              입금대기 전환·정보공유 구매 시 1코인 차감 · 매월 1일(KST) 리셋
            </p>
            {showDetailLink ? (
              <Link
                to={TENANT_SUBSCRIPTION_ADMIN_PATH}
                className="inline-block text-[11px] font-semibold text-indigo-700 underline-offset-2 hover:underline"
              >
                가입정보에서 자세히 보기
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 sm:px-4 ${tone} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-fluid-xs font-semibold sm:text-fluid-sm">
            이번 달 {coin.label}
            {coin.unlimited ? (
              <span className="ml-1.5 font-bold">무제한</span>
            ) : (
              <span className="ml-1.5 tabular-nums">
                {coin.used.toLocaleString()} / {coin.limit?.toLocaleString() ?? '0'}
                {coin.unit}
                {coin.remaining != null ? (
                  <span className="ml-1 font-normal opacity-90">
                    (잔여 {coin.remaining.toLocaleString()})
                  </span>
                ) : null}
              </span>
            )}
          </p>
          <p className="mt-0.5 hidden text-[11px] leading-snug opacity-80 sm:block">
            입금대기 전환 시 1코인 · 매월 1일 리셋
            {level === 'over' ? ' · 코인 부족 시 입금대기 전환 불가' : null}
          </p>
        </div>
        {showDetailLink ? (
          <Link
            to={TENANT_SUBSCRIPTION_ADMIN_PATH}
            className="shrink-0 text-[11px] font-semibold text-indigo-700 underline-offset-2 hover:underline"
          >
            가입정보
          </Link>
        ) : null}
      </div>
      {!coin.unlimited && fillPercent != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
          <div
            className={[
              'h-full rounded-full transition-all',
              level === 'over' ? 'bg-rose-500' : level === 'warn' ? 'bg-amber-500' : 'bg-indigo-600',
            ].join(' ')}
            style={{ width: `${Math.min(100, fillPercent)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
