import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { TenantBillingOperationalStatusCode } from '@shared/tenantBilling';
import {
  confirmPlatformInvoicePayment,
  confirmPlatformPrepaid,
  confirmPlatformSchedulePeriodPayment,
  getPlatformBillingSettings,
  listPlatformBillingTenants,
  patchPlatformBillingSettings,
  type PlatformBillingActionQueueItem,
  type PlatformBillingKpi,
  type PlatformBillingTenantRow,
} from '../../api/platformBilling';
import { PlatformTenantBillingPanel } from './PlatformTenantBillingPanel';
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
import { KoreanBankNameField } from '../../components/ui/KoreanBankNameField';
import {
  TENANT_BILLING_CYCLE_LABEL,
  TENANT_BILLING_PRICING_MODE_LABEL,
  formatNextDueDateLabel,
  formatBillingAnchorDayLabel,
} from '@shared/tenantBilling';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import {
  clampListPage,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';

export { PlatformTenantBillingPanel };

function formatKoDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

type RowAction =
  | { kind: 'trial_start'; label: string }
  | { kind: 'confirm_invoice'; label: string; invoiceId: string }
  | { kind: 'confirm_schedule'; label: string; periodStart: string }
  | { kind: 'setup_required'; label: string }
  | null;

function resolveRowAction(row: PlatformBillingTenantRow): RowAction {
  const code = row.operationalStatus.code;
  if (code === 'TRIAL_UNPAID' || code === 'PENDING_START') {
    return { kind: 'trial_start', label: '체험 시작' };
  }
  if (code === 'SETUP_REQUIRED') {
    return { kind: 'setup_required', label: '설정' };
  }
  if ((code === 'ACTIVE_BILLED' || code === 'ACTIVE_OVERDUE') && row.openInvoiceId) {
    return { kind: 'confirm_invoice', label: '입금 확인', invoiceId: row.openInvoiceId };
  }
  if (code === 'ACTIVE_UNPAID_SCHEDULED' && row.currentPeriodStart) {
    return {
      kind: 'confirm_schedule',
      label: '입금 확인',
      periodStart: row.currentPeriodStart,
    };
  }
  return null;
}

function resolveQueueAction(item: PlatformBillingActionQueueItem): RowAction {
  if (item.actionKind === 'trial_start') return { kind: 'trial_start', label: item.actionLabel };
  if (item.actionKind === 'setup_required') return { kind: 'setup_required', label: item.actionLabel };
  if (item.actionKind === 'confirm_invoice' && item.openInvoiceId) {
    return { kind: 'confirm_invoice', label: item.actionLabel, invoiceId: item.openInvoiceId };
  }
  if (item.actionKind === 'confirm_schedule' && item.currentPeriodStart) {
    return {
      kind: 'confirm_schedule',
      label: item.actionLabel,
      periodStart: item.currentPeriodStart,
    };
  }
  return null;
}

const OPERATIONAL_FILTER_OPTIONS: { value: '' | TenantBillingOperationalStatusCode; label: string }[] = [
  { value: '', label: '전체 운영 상태' },
  { value: 'ACTIVE_OK', label: '정상' },
  { value: 'TRIAL_PAID', label: '체험 중' },
  { value: 'TRIAL_UNPAID', label: '체험 전' },
  { value: 'ACTIVE_BILLED', label: '청구·미납' },
  { value: 'ACTIVE_OVERDUE', label: '연체' },
  { value: 'ACTIVE_UNPAID_SCHEDULED', label: '미입금(예정)' },
  { value: 'SETUP_REQUIRED', label: '과금 설정 필요' },
  { value: 'SUSPENDED', label: '중지' },
];

const EMPTY_KPI: PlatformBillingKpi = {
  total: 0,
  healthy: 0,
  billingIssue: 0,
  actionRequired: 0,
};

export function PlatformBillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<PlatformBillingTenantRow[]>([]);
  const [kpi, setKpi] = useState<PlatformBillingKpi>(EMPTY_KPI);
  const [actionQueue, setActionQueue] = useState<PlatformBillingActionQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    paymentGuideText: '',
    overdueGraceDays: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const q = searchParams.get('q') ?? '';
  const filterPlan = searchParams.get('plan') ?? '';
  const filterStatus = searchParams.get('status') ?? '';
  const filterOperational = (searchParams.get('operationalCode') ?? '') as '' | TenantBillingOperationalStatusCode;
  const actionQueueOnly = searchParams.get('actionQueue') === '1';
  const page = parseListPage(searchParams.get('page'));
  const pageSize = parseInquiryListPageSize(searchParams.get('pageSize'));

  const patchParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (resetPage) next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const loadList = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await listPlatformBillingTenants(token, {
        q,
        plan: filterPlan || undefined,
        status: filterStatus || undefined,
        operationalCode: filterOperational || undefined,
        actionQueue: actionQueueOnly,
        page,
        pageSize,
      });
      setItems(data.items);
      setTotal(data.total);
      setKpi(data.kpi);
      setActionQueue(data.actionQueue);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [q, filterPlan, filterStatus, filterOperational, actionQueueOnly, page, pageSize]);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    getPlatformBillingSettings(token)
      .then((s) => {
        setSettings({
          bankName: s.bankName ?? '',
          accountNumber: s.accountNumber ?? '',
          accountHolder: s.accountHolder ?? '',
          paymentGuideText: s.paymentGuideText ?? '',
          overdueGraceDays: s.overdueGraceDays,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const safePage = useMemo(
    () => clampListPage(page, total, pageSize),
    [page, total, pageSize],
  );

  const hasFilters = Boolean(q || filterPlan || filterStatus || filterOperational || actionQueueOnly);

  const runAction = async (tenantId: string, action: RowAction, key: string) => {
    const token = getPlatformToken();
    if (!token || !action) return;
    if (action.kind === 'setup_required') return;

    const confirmMsg =
      action.kind === 'trial_start'
        ? '체험을 시작하시겠습니까?'
        : '입금 확인 처리하시겠습니까?';
    if (!window.confirm(confirmMsg)) return;

    setBusyKey(key);
    setMessage('');
    setError('');
    try {
      if (action.kind === 'trial_start') {
        const result = await confirmPlatformPrepaid(token, tenantId);
        setMessage(result.message);
      } else if (action.kind === 'confirm_invoice') {
        await confirmPlatformInvoicePayment(token, action.invoiceId);
        setMessage('입금 확인되었습니다.');
      } else if (action.kind === 'confirm_schedule') {
        await confirmPlatformSchedulePeriodPayment(token, tenantId, action.periodStart);
        setMessage('입금 확인되었습니다.');
      }
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyKey(null);
    }
  };

  const saveSettings = async () => {
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchPlatformBillingSettings(token, {
        bankName: settings.bankName || null,
        accountNumber: settings.accountNumber || null,
        accountHolder: settings.accountHolder || null,
        paymentGuideText: settings.paymentGuideText || null,
        overdueGraceDays: settings.overdueGraceDays,
      });
      setMessage('입금 안내 설정이 저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 min-w-0 w-full max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">결제 관리</h1>
        <p className="mt-1 text-sm text-gray-500">업체별 이용료·약정·자동 청구·예외 관리</p>
      </div>

      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-gray-300"
          onClick={() => patchParams({ actionQueue: null, operationalCode: null, status: null, plan: null, q: null }, true)}
        >
          <div className="text-2xl font-bold text-gray-900">{kpi.total.toLocaleString('ko-KR')}</div>
          <div className="mt-1 text-xs text-gray-500">전체 업체</div>
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-emerald-200"
          onClick={() => patchParams({ operationalCode: 'ACTIVE_OK', actionQueue: null }, true)}
        >
          <div className="text-2xl font-bold text-emerald-600">{kpi.healthy.toLocaleString('ko-KR')}</div>
          <div className="mt-1 text-xs text-gray-500">정상·체험 이용</div>
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-rose-200"
          onClick={() => patchParams({ operationalCode: 'ACTIVE_OVERDUE', actionQueue: null }, true)}
        >
          <div className="text-2xl font-bold text-rose-600">{kpi.billingIssue.toLocaleString('ko-KR')}</div>
          <div className="mt-1 text-xs text-gray-500">미납·청구 이슈</div>
        </button>
        <button
          type="button"
          className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-amber-200"
          onClick={() => patchParams({ actionQueue: '1', operationalCode: null }, true)}
        >
          <div className="text-2xl font-bold text-amber-600">{kpi.actionRequired.toLocaleString('ko-KR')}</div>
          <div className="mt-1 text-xs text-gray-500">조치 대기</div>
        </button>
      </div>

      {actionQueue.length > 0 ? (
        <section className={CARD_SECTION}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">액션 큐</h2>
            <span className="text-xs text-gray-500">처리가 필요한 업체 {actionQueue.length}건</span>
          </div>
          <ul className="mt-3 space-y-2">
            {actionQueue.map((item) => {
              const action = resolveQueueAction(item);
              const key = `${item.tenantId}:${item.actionKind}`;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {item.name}{' '}
                      <span className="font-mono text-xs font-normal text-gray-500">({item.slug})</span>
                    </p>
                    <p className="text-xs text-gray-600">
                      {item.operationalLabel}
                      {item.operationalDetail ? ` · ${item.operationalDetail}` : ''}
                      {item.amountKrw != null ? ` · ${item.amountKrw.toLocaleString('ko-KR')}원` : ''}
                      {item.dueDate ? ` · ${formatYmd(item.dueDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {action?.kind === 'setup_required' ? (
                      <Link to={`/platform/tenants/${item.tenantId}`} className={`${BTN_SECONDARY} text-xs`}>
                        {action.label}
                      </Link>
                    ) : action ? (
                      <button
                        type="button"
                        disabled={busyKey === key}
                        onClick={() => void runAction(item.tenantId, action, key)}
                        className={`${BTN_PRIMARY} text-xs`}
                      >
                        {action.label}
                      </button>
                    ) : null}
                    <Link
                      to={`/platform/tenants/${item.tenantId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      상세
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">입금 안내 (전체 공통)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">은행</span>
            <div className="mt-1">
              <KoreanBankNameField
                value={settings.bankName}
                onChange={(bankName) => setSettings((s) => ({ ...s, bankName }))}
                selectClassName={INPUT_BASE}
                inputClassName={INPUT_BASE}
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">계좌번호</span>
            <input
              className={`mt-1 ${INPUT_BASE}`}
              value={settings.accountNumber}
              onChange={(e) => setSettings((s) => ({ ...s, accountNumber: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">예금주</span>
            <input
              className={`mt-1 ${INPUT_BASE}`}
              value={settings.accountHolder}
              onChange={(e) => setSettings((s) => ({ ...s, accountHolder: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">연체 유예 (일)</span>
            <input
              type="number"
              min={0}
              max={30}
              className={`mt-1 ${INPUT_BASE}`}
              value={settings.overdueGraceDays}
              onChange={(e) =>
                setSettings((s) => ({ ...s, overdueGraceDays: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">납부 안내 문구</span>
            <textarea
              rows={3}
              className={`mt-1 ${INPUT_BASE}`}
              value={settings.paymentGuideText}
              onChange={(e) => setSettings((s) => ({ ...s, paymentGuideText: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={saving} onClick={() => void saveSettings()} className={BTN_PRIMARY}>
            설정 저장
          </button>
        </div>
      </section>

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">업체 목록</h2>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="업체명·코드 검색"
            className={`${INPUT_BASE} min-w-[180px] flex-1`}
            value={q}
            onChange={(e) => patchParams({ q: e.target.value || null }, true)}
          />
          <select
            value={filterPlan}
            onChange={(e) => patchParams({ plan: e.target.value || null }, true)}
            className={`${INPUT_BASE} w-auto`}
          >
            <option value="">전체 플랜</option>
            <option value="free">Free</option>
            <option value="standard">Standard</option>
            <option value="standard_plus">Standard+</option>
            <option value="premium">Premium</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => patchParams({ status: e.target.value || null }, true)}
            className={`${INPUT_BASE} w-auto`}
          >
            <option value="">전체 상태</option>
            <option value="ACTIVE">운영</option>
            <option value="TRIAL">체험</option>
            <option value="SUSPENDED">중지</option>
          </select>
          <select
            value={filterOperational}
            onChange={(e) => patchParams({ operationalCode: e.target.value || null }, true)}
            className={`${INPUT_BASE} w-auto max-w-[180px]`}
          >
            {OPERATIONAL_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={actionQueueOnly}
              onChange={(e) => patchParams({ actionQueue: e.target.checked ? '1' : null }, true)}
            />
            조치 대기만
          </label>
          {hasFilters ? (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() =>
                patchParams(
                  { q: null, plan: null, status: null, operationalCode: null, actionQueue: null },
                  true,
                )
              }
            >
              초기화
            </button>
          ) : null}
        </div>

        <ListPaginationBar
          mode="summary"
          page={safePage}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => patchParams({ page: String(p) })}
          onPageSizeChange={(size) => patchParams({ pageSize: String(size), page: '1' })}
        />

        <div className="mt-3 overflow-x-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-gray-500">불러오는 중…</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {hasFilters ? '조건에 맞는 업체가 없습니다.' : '등록된 업체가 없습니다.'}
            </p>
          ) : (
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 text-center">업체</th>
                  <th className="py-2 text-center">플랜</th>
                  <th className="py-2 text-center">운영 상태</th>
                  <th className="py-2 text-center">약정</th>
                  <th className="py-2 text-center">시작</th>
                  <th className="py-2 text-center">다음 납부</th>
                  <th className="py-2 text-center">청구</th>
                  <th className="py-2 text-center">액션</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const action = resolveRowAction(row);
                  const rowKey = row.tenantId;
                  return (
                    <tr key={row.tenantId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 text-center">
                        <div className="font-medium text-gray-900">{row.name}</div>
                        <div className="text-xs font-mono text-gray-500">{row.slug}</div>
                      </td>
                      <td className="py-2 text-center">
                        <PlanBadge plan={row.plan} />
                      </td>
                      <td className="py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <BillingOperationalBadge
                            code={row.operationalStatus.code}
                            label={row.operationalStatus.label}
                            detail={row.operationalStatus.detail}
                          />
                          <StatusBadge status={row.status} />
                        </div>
                      </td>
                      <td className="py-2 text-center text-xs">
                        <div>{TENANT_BILLING_CYCLE_LABEL[row.billingCycle]}</div>
                        <div className="text-gray-500">{TENANT_BILLING_PRICING_MODE_LABEL[row.pricingMode]}</div>
                        <div className="tabular-nums">{row.contractAmountKrw.toLocaleString('ko-KR')}원</div>
                      </td>
                      <td className="py-2 text-center text-xs">{formatKoDate(row.serviceStartedAt)}</td>
                      <td className="py-2 text-center text-xs">
                        {row.nextDueDate
                          ? formatNextDueDateLabel(row.billingCycle, row.nextDueDate)
                          : '—'}
                        <div className="text-gray-500">
                          {formatBillingAnchorDayLabel(row.serviceStartedAt) ?? '시작일 확정 후'}
                        </div>
                      </td>
                      <td className="py-2 text-center text-xs">
                        {row.openInvoiceStatus ? (
                          <>
                            {row.openInvoiceStatus === 'OVERDUE' ? (
                              <span className="font-medium text-rose-700">연체</span>
                            ) : (
                              '청구 중'
                            )}
                            {row.openInvoiceDueDate ? (
                              <div className="text-gray-500">{formatYmd(row.openInvoiceDueDate)}</div>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {action?.kind === 'setup_required' ? (
                            <Link
                              to={`/platform/tenants/${row.tenantId}`}
                              className={`${BTN_SECONDARY} px-2 py-1 text-xs`}
                            >
                              {action.label}
                            </Link>
                          ) : action ? (
                            <button
                              type="button"
                              disabled={busyKey === rowKey}
                              onClick={() => void runAction(row.tenantId, action, rowKey)}
                              className={`${BTN_PRIMARY} px-2 py-1 text-xs`}
                            >
                              {action.label}
                            </button>
                          ) : null}
                          <Link
                            to={`/platform/tenants/${row.tenantId}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            상세
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && total > 0 ? (
          <ListPaginationBar
            mode="nav"
            page={safePage}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => patchParams({ page: String(p) })}
            onPageSizeChange={(size) =>
              patchParams({ pageSize: String(size), page: '1' })
            }
          />
        ) : null}
      </section>
    </div>
  );
}
