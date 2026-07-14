import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TENANT_BILLING_ADJUSTMENT_TYPE_LABEL,
  type TenantBillingAdjustmentType,
} from '@shared/tenantBilling';
import {
  confirmPlatformPrepaid,
  confirmPlatformSchedulePeriodPayment,
  createPlatformBillingAdjustment,
  getPlatformTenantBillingSchedule,
  issuePlatformTenantInvoice,
  voidPlatformBillingAdjustment,
  voidPlatformInvoice,
  type BillingScheduleRow,
} from '../../api/platformBilling';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { getPlatformToken } from '../../stores/platformAuth';
import { kstTodayYmd } from '../../utils/dateFormat';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';
import { BTN_SECONDARY } from '../../utils/platformUi';
import { PlatformTenantBillingScheduleTable } from './PlatformTenantBillingScheduleTable';

type DatePreset = 'today' | 'all' | 'month' | 'day';

type Props = {
  tenantId: string;
  onMutate?: () => void;
  showPrepaidConfirm?: boolean;
};

function parseDatePreset(raw: string | null): DatePreset {
  if (raw === 'today' || raw === 'month' || raw === 'day') return raw;
  return 'all';
}

export function PlatformTenantBillingScheduleSection({
  tenantId,
  onMutate,
  showPrepaidConfirm,
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [schedule, setSchedule] = useState<BillingScheduleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const datePreset = parseDatePreset(searchParams.get('schPreset'));
  const monthKey = searchParams.get('schMonth') ?? kstTodayYmd().slice(0, 7);
  const dayKey = searchParams.get('schDay') ?? kstTodayYmd();
  const page = parseListPage(searchParams.get('schPage'));
  const pageSize = parseInquiryListPageSize(searchParams.get('schPageSize'));

  const patchParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (resetPage) next.set('schPage', '1');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const loadSchedule = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPlatformTenantBillingSchedule(token, tenantId, {
        datePreset,
        month: datePreset === 'month' ? monthKey : undefined,
        day: datePreset === 'day' ? dayKey : undefined,
        page,
        pageSize,
      });
      setSchedule(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '청구 일정 조회 실패');
      setSchedule([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenantId, datePreset, monthKey, dayKey, page, pageSize]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const safePage = useMemo(
    () => clampListPage(page, total, pageSize),
    [page, total, pageSize],
  );

  useEffect(() => {
    if (safePage !== page && total > 0) {
      patchParams({ schPage: String(safePage) });
    }
  }, [safePage, page, patchParams, total]);

  const afterMutate = async () => {
    await loadSchedule();
    onMutate?.();
  };

  const onIssueInvoiceForPeriod = async (periodStartYmd: string) => {
    if (!window.confirm('해당 기간 청구서를 발행하시겠습니까?')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await issuePlatformTenantInvoice(token, tenantId, { periodStart: periodStartYmd });
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '발행 실패');
    } finally {
      setSaving(false);
    }
  };

  const onConfirmPayment = async (periodStartYmd: string) => {
    if (!window.confirm('입금 완료 처리하시겠습니까? (미발행이면 청구 후 바로 완료됩니다)')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await confirmPlatformSchedulePeriodPayment(token, tenantId, periodStartYmd);
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 실패');
    } finally {
      setSaving(false);
    }
  };

  const onPrepaidConfirm = async () => {
    if (!window.confirm('입금을 확인하시겠습니까? 확인 후 7일 체험이 시작됩니다.')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await confirmPlatformPrepaid(token, tenantId);
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 실패');
    } finally {
      setSaving(false);
    }
  };

  const onVoidInvoice = async (invoiceId: string) => {
    if (!window.confirm('청구서를 취소(무효)하시겠습니까?')) return;
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await voidPlatformInvoice(token, invoiceId);
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소 실패');
    } finally {
      setSaving(false);
    }
  };

  const onApplyAdjustment = async (
    type: TenantBillingAdjustmentType,
    periodStartYmd: string,
    customAmountKrw?: number,
  ) => {
    const typeLabel = TENANT_BILLING_ADJUSTMENT_TYPE_LABEL[type];
    let amount = customAmountKrw;
    if (type === 'CUSTOM_AMOUNT' && amount == null) {
      const raw = window.prompt('1회 청구 금액(원)을 입력하세요');
      if (raw == null || !raw.trim()) return;
      amount = Number(raw.replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount < 0) {
        setError('금액을 확인해 주세요.');
        return;
      }
    }
    const reason = window.prompt('사유를 입력하세요');
    if (reason == null || !reason.trim()) return;
    if (!window.confirm(`${typeLabel} 처리하시겠습니까? (${periodStartYmd})`)) return;

    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await createPlatformBillingAdjustment(token, tenantId, {
        type,
        targetPeriodStart: periodStartYmd,
        reason: reason.trim(),
        customAmountKrw: type === 'CUSTOM_AMOUNT' ? Math.trunc(amount!) : undefined,
      });
      await afterMutate();
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
    setError('');
    try {
      await voidPlatformBillingAdjustment(token, tenantId, adjustmentId);
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-3">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex flex-col gap-3 border-b border-gray-100 pb-3">
        <div className="flex flex-col gap-2 min-w-0 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs font-semibold text-gray-700 shrink-0">이용 시작일</span>
            <div className="inline-flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded border border-gray-300 overflow-hidden text-xs shrink-0">
                {(
                  [
                    ['today', '당일'],
                    ['all', '전체'],
                    ['month', '월별'],
                    ['day', '날짜'],
                  ] as const
                ).map(([value, label], idx) => (
                  <button
                    key={value}
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      patchParams(
                        {
                          schPreset: value,
                          schPage: '1',
                          ...(value === 'month' && !searchParams.get('schMonth')
                            ? { schMonth: kstTodayYmd().slice(0, 7) }
                            : {}),
                          ...(value === 'day' && !searchParams.get('schDay')
                            ? { schDay: kstTodayYmd() }
                            : {}),
                        },
                        true,
                      )
                    }
                    className={[
                      'px-3 py-1.5 font-medium',
                      idx > 0 ? 'border-l border-gray-300' : '',
                      datePreset === value
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {datePreset === 'month' ? (
                <YearMonthSelect
                  value={monthKey}
                  onChange={(v) => patchParams({ schMonth: v, schPage: '1' }, true)}
                  idPrefix="billing-schedule-month"
                  className="items-center"
                />
              ) : null}
              {datePreset === 'day' ? (
                <YmdSelect
                  value={dayKey}
                  onChange={(v) => patchParams({ schDay: v, schPage: '1' }, true)}
                  idPrefix="billing-schedule-day"
                  className="items-center"
                />
              ) : null}
            </div>
          </div>
          <ListPaginationBar
            mode="summary"
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => patchParams({ schPage: String(p) })}
            onPageSizeChange={(size) =>
              patchParams({ schPageSize: String(size), schPage: '1' }, true)
            }
            className="shrink-0"
          />
        </div>
        <p className="text-xs text-gray-500">
          과금 시작일부터 이용 기간이 순서대로 쌓입니다. 미래 회차는 다음 1회만 미리 표시됩니다.
          입금완료는 청구서 발행 없이도 누를 수 있으며, 체험 중·예정 회차도 확인 가능합니다.
        </p>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">일정 불러오는 중…</p>
      ) : (
        <>
          <PlatformTenantBillingScheduleTable
            schedule={schedule}
            saving={saving}
            onApplyAdjustment={onApplyAdjustment}
            onVoidAdjustment={onVoidAdjustment}
            onIssueInvoice={onIssueInvoiceForPeriod}
            onConfirmPayment={onConfirmPayment}
            onVoidInvoice={onVoidInvoice}
            showPrepaidConfirm={showPrepaidConfirm}
            onPrepaidConfirm={onPrepaidConfirm}
          />
          {total > 0 ? (
            <ListPaginationBar
              mode="nav"
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => patchParams({ schPage: String(p) })}
              onPageSizeChange={(size) =>
                patchParams({ schPageSize: String(size), schPage: '1' }, true)
              }
            />
          ) : null}
        </>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void loadSchedule()}
          className={BTN_SECONDARY}
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
