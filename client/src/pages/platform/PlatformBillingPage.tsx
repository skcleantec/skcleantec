import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  confirmPlatformInvoicePayment,
  confirmPlatformPrepaid,
  getPlatformBillingSettings,
  getPlatformTenantBilling,
  issuePlatformTenantInvoice,
  listPlatformBillingTenants,
  patchPlatformBillingSettings,
  patchPlatformTenantBillingProfile,
  type PlatformBillingTenantRow,
  type PlatformTenantBillingDetail,
} from '../../api/platformBilling';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
  PlanBadge,
  PlatformAlert,
  StatusBadge,
} from '../../utils/platformUi';
import {
  TENANT_BILLING_CYCLE_LABEL,
  TENANT_INVOICE_STATUS_LABEL,
  billingCyclePriceHint,
  type TenantBillingCycle,
} from '@shared/tenantBilling';
import type { TenantPlanId } from '@shared/tenantFeatureModules';

function formatKoDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

type Props = {
  tenantId: string;
  compact?: boolean;
};

export function PlatformTenantBillingPanel({ tenantId, compact }: Props) {
  const [detail, setDetail] = useState<PlatformTenantBillingDetail | null>(null);
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
      setDetail(await getPlatformTenantBilling(token, tenantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCycleChange = async (cycle: TenantBillingCycle) => {
    const token = getPlatformToken();
    if (!token || !detail) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await patchPlatformTenantBillingProfile(token, tenantId, cycle);
      setMessage('납부 주기가 저장되었습니다.');
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

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!detail) {
    return <PlatformAlert variant="error" message={error || '데이터를 불러올 수 없습니다.'} />;
  }

  const { tenant, profile, summary, invoices } = detail;
  const planId = tenant.plan as TenantPlanId;

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
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">체험 종료</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDate(tenant.trialEndsAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">선납 확인</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDate(tenant.prepaidConfirmedAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">서비스 시작</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDate(tenant.serviceStartedAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">업무 차단</dt>
            <dd className="mt-0.5 text-gray-900">{formatKoDate(tenant.billingAccessBlockedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">납부 주기 · 금액</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {(['MONTHLY', 'ANNUAL'] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              disabled={saving}
              onClick={() => void onCycleChange(cycle)}
              className={[
                'rounded-lg border px-3 py-2 text-sm',
                profile.billingCycle === cycle
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {TENANT_BILLING_CYCLE_LABEL[cycle]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-700">{billingCyclePriceHint(planId, profile.billingCycle)}</p>
        <p className="mt-1 text-xs text-gray-500">연납 할인율 20% (VAT 별도)</p>
      </section>

      <section className={CARD_SECTION}>
        <h3 className="text-sm font-semibold text-gray-900">플랫폼 작업</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {!tenant.prepaidConfirmedAt && (tenant.status === 'TRIAL' || tenant.status === 'SUSPENDED') ? (
            <button type="button" disabled={saving} onClick={() => void onPrepaidConfirm()} className={BTN_PRIMARY}>
              사용료 수령 확인
            </button>
          ) : null}
          {tenant.serviceStartedAt ? (
            <button type="button" disabled={saving} onClick={() => void onIssueInvoice()} className={BTN_SECONDARY}>
              다음 청구서 발행
            </button>
          ) : null}
          <button type="button" disabled={saving} onClick={() => void load()} className={BTN_SECONDARY}>
            새로고침
          </button>
        </div>
        {tenant.prepaidConfirmedAt && !tenant.serviceStartedAt ? (
          <p className="mt-2 text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2">
            선납 확인 후 7일이 지나면 자동으로 서비스가 시작되고 첫 청구서가 발행됩니다.
          </p>
        ) : null}
      </section>

      {(summary.openInvoice || summary.overdueInvoice) && (
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
                    <span className="ml-2 text-xs rounded bg-white px-1.5 py-0.5 border">
                      {TENANT_INVOICE_STATUS_LABEL[inv.status]}
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

export function PlatformBillingPage() {
  const [items, setItems] = useState<PlatformBillingTenantRow[]>([]);
  const [settings, setSettings] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    paymentGuideText: '',
    overdueGraceDays: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    Promise.all([listPlatformBillingTenants(token), getPlatformBillingSettings(token)])
      .then(([rows, s]) => {
        setItems(rows);
        setSettings({
          bankName: s.bankName ?? '',
          accountNumber: s.accountNumber ?? '',
          accountHolder: s.accountHolder ?? '',
          paymentGuideText: s.paymentGuideText ?? '',
          overdueGraceDays: s.overdueGraceDays,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q),
    );
  }, [items, search]);

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

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  return (
    <div className="space-y-6 pb-8 min-w-0 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">결제 관리</h1>
        <p className="mt-1 text-sm text-gray-500">업체별 이용료·선납 확인·청구서 납부 확인</p>
      </div>

      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">입금 안내 (전체 공통)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600">은행</span>
            <input
              className={`mt-1 ${INPUT_BASE}`}
              value={settings.bankName}
              onChange={(e) => setSettings((s) => ({ ...s, bankName: e.target.value }))}
            />
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
        <div className="flex justify-end">
          <button type="button" disabled={saving} onClick={() => void saveSettings()} className={BTN_PRIMARY}>
            설정 저장
          </button>
        </div>
      </section>

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">업체 목록</h2>
          <input
            type="search"
            placeholder="업체명·코드 검색"
            className={`${INPUT_BASE} max-w-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 text-center">업체</th>
                <th className="py-2 text-center">플랜</th>
                <th className="py-2 text-center">상태</th>
                <th className="py-2 text-center">주기</th>
                <th className="py-2 text-center">체험 종료</th>
                <th className="py-2 text-center">청구</th>
                <th className="py-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.tenantId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 text-center">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{row.slug}</div>
                  </td>
                  <td className="py-2 text-center">
                    <PlanBadge plan={row.plan} />
                  </td>
                  <td className="py-2 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2 text-center">{TENANT_BILLING_CYCLE_LABEL[row.billingCycle]}</td>
                  <td className="py-2 text-center text-xs">{formatKoDate(row.trialEndsAt)}</td>
                  <td className="py-2 text-center text-xs">
                    {row.openInvoiceStatus ? (
                      <>
                        {row.openInvoiceStatus === 'OVERDUE' ? (
                          <span className="text-rose-700 font-medium">연체</span>
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
                    <Link to={`/platform/tenants/${row.tenantId}`} className="text-blue-600 hover:underline text-xs">
                      상세
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
