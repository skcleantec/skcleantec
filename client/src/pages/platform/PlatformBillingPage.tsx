import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPlatformBillingSettings,
  listPlatformBillingTenants,
  patchPlatformBillingSettings,
  type PlatformBillingTenantRow,
} from '../../api/platformBilling';
import { PlatformTenantBillingPanel } from './PlatformTenantBillingPanel';
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
import { TENANT_BILLING_CYCLE_LABEL, TENANT_BILLING_PRICING_MODE_LABEL, formatNextDueDateLabel } from '@shared/tenantBilling';

export { PlatformTenantBillingPanel };

function formatKoDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatYmd(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
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
        <p className="mt-1 text-sm text-gray-500">업체별 이용료·약정·자동 청구·예외 관리</p>
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
          <table className="w-full min-w-[900px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2 text-center">업체</th>
                <th className="py-2 text-center">플랜</th>
                <th className="py-2 text-center">운영 상태</th>
                <th className="py-2 text-center">약정</th>
                <th className="py-2 text-center">시작</th>
                <th className="py-2 text-center">다음 납부</th>
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
                    <div className="text-gray-500">매월 {row.billingDueDay}일</div>
                  </td>
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
