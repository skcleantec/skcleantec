import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchTenantBillingDunning,
  type TenantBillingDunning,
  type TenantBillingSummary,
} from '../../api/tenantBilling';
import {
  TENANT_BILLING_DUNNING_POPUP_DEFAULTS,
  TENANT_INVOICE_STATUS_LABEL,
  formatDunningBlockSoonText,
} from '@shared/tenantBilling';

type Props = {
  open: boolean;
  onClose: () => void;
  token: string | null;
  billing: TenantBillingSummary | null;
};

function formatKoDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatKoDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function TenantBillingPaymentGuideModal({ open, onClose, token, billing }: Props) {
  const [loading, setLoading] = useState(false);
  const [dunning, setDunning] = useState<TenantBillingDunning | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invoice = billing?.overdueInvoice ?? billing?.openInvoice ?? null;

  useEffect(() => {
    if (!open || !token || !billing) {
      setDunning(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!billing.overdueInvoice) {
      setDunning(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchTenantBillingDunning(token)
      .then((data) => {
        if (cancelled) return;
        setDunning(data.showDunning ? data : null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '불러오기 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, billing]);

  if (!open || !billing) return null;

  const popup = dunning?.popup ?? {
    title: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.title,
    subtitle: billing.overdueInvoice
      ? TENANT_BILLING_DUNNING_POPUP_DEFAULTS.subtitle
      : '이용료 입금이 확인되지 않았습니다',
    body: billing.bank.paymentGuideText?.trim()
      ? billing.bank.paymentGuideText
      : TENANT_BILLING_DUNNING_POPUP_DEFAULTS.body,
    blockSoonText: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.blockSoonText,
    blockTodayText: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.blockTodayText,
  };

  const bankLine = [billing.bank.bankName, billing.bank.accountNumber, billing.bank.accountHolder]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-payment-guide-title"
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white">
          <h2 id="billing-payment-guide-title" className="text-base font-semibold">
            {popup.title}
          </h2>
          <p className="mt-0.5 text-xs text-amber-50/95">{popup.subtitle}</p>
        </div>

        <div className="p-4 space-y-3">
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          {loading ? <p className="text-sm text-gray-500">안내 불러오는 중…</p> : null}

          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{popup.body}</p>

          {invoice ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-sm space-y-1.5">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-gray-600">청구 금액</span>
                <span className="font-semibold tabular-nums text-gray-900">
                  {invoice.amountKrw.toLocaleString('ko-KR')}원
                  <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-gray-500">이용 기간</span>
                <span className="text-gray-800">
                  {formatKoDate(invoice.periodStart)} ~ {formatKoDate(invoice.periodEnd)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-gray-500">납부기한</span>
                <span className="text-gray-800">{formatKoDate(invoice.dueDate)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-gray-500">상태</span>
                <span className="font-medium text-amber-900">
                  {TENANT_INVOICE_STATUS_LABEL[invoice.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ??
                    invoice.status}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-sm">
              <p className="text-gray-700">
                이용료 {billing.amountLabel} · {billing.operationalStatus.detail ?? '입금 확인 후 서비스가 시작됩니다.'}
              </p>
            </div>
          )}

          {dunning?.daysUntilBlock != null && dunning.daysUntilBlock > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-950">
              <p className="font-medium">
                {formatDunningBlockSoonText(popup.blockSoonText, dunning.daysUntilBlock)}
              </p>
              {dunning.accessBlockAt ? (
                <p className="mt-1 text-xs text-rose-800/90">
                  제한 예정: {formatKoDateTime(dunning.accessBlockAt)} (유예 {dunning.overdueGraceDays}일)
                </p>
              ) : null}
            </div>
          ) : dunning?.daysUntilBlock === 0 ? (
            <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-900">
              {popup.blockTodayText}
            </div>
          ) : null}

          {bankLine ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
              <p className="text-xs font-medium text-gray-500">입금 계좌</p>
              <p className="mt-1 text-gray-900">{bankLine}</p>
              {billing.bank.paymentGuideText && !invoice ? (
                <p className="mt-1.5 text-xs text-gray-600 whitespace-pre-wrap">{billing.bank.paymentGuideText}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <Link
              to="/admin/subscription"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              이용료 상세 보기
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
