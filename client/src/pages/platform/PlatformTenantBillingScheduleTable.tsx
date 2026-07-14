import {
  TENANT_BILLING_ADJUSTMENT_TYPE_LABEL,
  TENANT_BILLING_SCHEDULE_STATUS_LABEL,
  TENANT_INVOICE_STATUS_LABEL,
  type TenantBillingAdjustmentType,
} from '@shared/tenantBilling';
import type { BillingScheduleRow } from '../../api/platformBilling';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function ymdFromIso(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function scheduleStatusClass(status: string) {
  if (status === 'PAID') return 'text-emerald-700 bg-emerald-50';
  if (status === 'OVERDUE') return 'text-rose-700 bg-rose-50';
  if (status === 'ISSUED') return 'text-amber-800 bg-amber-50';
  if (status === 'SCHEDULED') return 'text-slate-600 bg-slate-50';
  if (status === 'SKIPPED' || status === 'DEFERRED') return 'text-violet-700 bg-violet-50';
  return 'text-gray-600 bg-gray-50';
}

const ACTION_BTN =
  'rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed';

type Props = {
  schedule: BillingScheduleRow[];
  saving: boolean;
  onApplyAdjustment: (
    type: TenantBillingAdjustmentType,
    periodStartYmd: string,
    customAmountKrw?: number,
  ) => Promise<void>;
  onVoidAdjustment: (adjustmentId: string) => Promise<void>;
  onIssueInvoice: (periodStartYmd: string) => Promise<void>;
  onConfirmPayment: (invoiceId: string) => Promise<void>;
  onVoidInvoice: (invoiceId: string) => Promise<void>;
};

export function PlatformTenantBillingScheduleTable({
  schedule,
  saving,
  onApplyAdjustment,
  onVoidAdjustment,
  onIssueInvoice,
  onConfirmPayment,
  onVoidInvoice,
}: Props) {
  if (schedule.length === 0) {
    return <p className="mt-2 text-sm text-gray-500">과금 시작일 설정 후 일정이 표시됩니다.</p>;
  }

  return (
    <>
      <p className="text-xs text-gray-500 lg:hidden">표는 좌우로 스크롤할 수 있습니다.</p>
      <SyncHorizontalScroll className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[960px] text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 text-center font-medium">이용 기간</th>
              <th className="py-2 text-center font-medium">납부일</th>
              <th className="py-2 text-center font-medium">금액</th>
              <th className="py-2 text-center font-medium">상태</th>
              <th className="py-2 text-center font-medium">면제</th>
              <th className="py-2 text-center font-medium">금액변경</th>
              <th className="py-2 text-center font-medium">이월(순연)</th>
              <th className="py-2 text-center font-medium">이월(합산)</th>
              <th className="py-2 text-center font-medium">청구</th>
              <th className="py-2 text-center font-medium">입금완료</th>
              <th className="py-2 text-center font-medium">취소</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => {
              const periodYmd = ymdFromIso(row.periodStart);
              const hasAdj = row.adjustment != null;
              const canAdjust =
                !hasAdj &&
                row.status !== 'PAID' &&
                row.status !== 'SKIPPED' &&
                row.status !== 'DEFERRED' &&
                row.status !== 'VOID';
              const canIssue =
                !row.invoiceId &&
                row.status !== 'SKIPPED' &&
                row.status !== 'DEFERRED' &&
                row.amountKrw > 0;
              const canPay =
                row.invoiceId != null && (row.status === 'ISSUED' || row.status === 'OVERDUE');
              const canVoidInvoice =
                row.invoiceId != null &&
                row.status !== 'PAID' &&
                row.status !== 'VOID' &&
                row.status !== 'SKIPPED';
              const statusLabel =
                TENANT_BILLING_SCHEDULE_STATUS_LABEL[row.status] ??
                TENANT_INVOICE_STATUS_LABEL[row.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ??
                row.status;

              return (
                <tr key={`${row.periodStart}-${row.status}-${row.invoiceId ?? 'x'}`} className="border-b border-gray-100">
                  <td className="py-2 text-center text-xs whitespace-nowrap">
                    {formatYmd(row.periodStart)} ~ {formatYmd(row.periodEnd)}
                  </td>
                  <td className="py-2 text-center text-xs">{formatYmd(row.dueDate)}</td>
                  <td className="py-2 text-center tabular-nums text-xs">
                    {row.amountKrw > 0 ? `${row.amountKrw.toLocaleString('ko-KR')}원` : '—'}
                  </td>
                  <td className="py-2 text-center">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs ${scheduleStatusClass(row.status)}`}
                      title={row.adjustment ? row.adjustment.reason : undefined}
                    >
                      {statusLabel}
                    </span>
                    {row.adjustment ? (
                      <div className="mt-0.5 text-[10px] text-violet-700 truncate max-w-[100px] mx-auto" title={row.adjustment.reason}>
                        {TENANT_BILLING_ADJUSTMENT_TYPE_LABEL[row.adjustment.type]}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 text-center">
                    {hasAdj ? (
                      <span className="text-xs text-violet-700">적용</span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving || !canAdjust}
                        className={ACTION_BTN}
                        onClick={() => void onApplyAdjustment('SKIP', periodYmd)}
                      >
                        면제
                      </button>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      disabled={saving || !canAdjust}
                      className={ACTION_BTN}
                      onClick={() => void onApplyAdjustment('CUSTOM_AMOUNT', periodYmd)}
                    >
                      금액
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      disabled={saving || !canAdjust}
                      className={ACTION_BTN}
                      onClick={() => void onApplyAdjustment('DEFER_SHIFT', periodYmd)}
                    >
                      순연
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      disabled={saving || !canAdjust}
                      className={ACTION_BTN}
                      onClick={() => void onApplyAdjustment('DEFER_MERGE', periodYmd)}
                    >
                      합산
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    {canIssue ? (
                      <button
                        type="button"
                        disabled={saving}
                        className={ACTION_BTN}
                        onClick={() => void onIssueInvoice(periodYmd)}
                      >
                        발행
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 text-center">
                    {canPay ? (
                      <button
                        type="button"
                        disabled={saving}
                        className={`${ACTION_BTN} border-emerald-300 text-emerald-800`}
                        onClick={() => void onConfirmPayment(row.invoiceId!)}
                      >
                        입금
                      </button>
                    ) : row.status === 'PAID' ? (
                      <span className="text-xs text-emerald-700">완료</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 text-center">
                    {canVoidInvoice ? (
                      <button
                        type="button"
                        disabled={saving}
                        className={`${ACTION_BTN} border-rose-200 text-rose-700`}
                        onClick={() => void onVoidInvoice(row.invoiceId!)}
                      >
                        취소
                      </button>
                    ) : hasAdj && !row.invoiceId ? (
                      <button
                        type="button"
                        disabled={saving}
                        className={`${ACTION_BTN} border-rose-200 text-rose-700`}
                        onClick={() => void onVoidAdjustment(row.adjustment!.id)}
                      >
                        취소
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SyncHorizontalScroll>
    </>
  );
}
