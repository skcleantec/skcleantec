import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTenantBillingDunning, type TenantBillingDunning } from '../../api/tenantBilling';
import { TENANT_INVOICE_STATUS_LABEL, formatDunningBlockSoonText } from '@shared/tenantBilling';
import { BillingPaymentConfirmationRequestButton } from './BillingPaymentConfirmationRequestButton';

const DISMISS_KEY_PREFIX = 'billing-dunning-dismissed:';

function dismissStorageKey(tenantId: string, invoiceId: string) {
  return `${DISMISS_KEY_PREFIX}${tenantId}:${invoiceId}`;
}

function isDismissedForSession(tenantId: string, invoiceId: string): boolean {
  try {
    return sessionStorage.getItem(dismissStorageKey(tenantId, invoiceId)) === '1';
  } catch {
    return false;
  }
}

function markDismissedForSession(tenantId: string, invoiceId: string) {
  try {
    sessionStorage.setItem(dismissStorageKey(tenantId, invoiceId), '1');
  } catch {
    /* ignore */
  }
}

function formatKoDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatKoDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

type Props = {
  open: boolean;
  token: string | null;
  tenantId: string | null;
  onClose: () => void;
};

export function BillingDunningModal({ open, token, tenantId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [dunning, setDunning] = useState<TenantBillingDunning | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !tenantId) {
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
        if (
          !data.showDunning ||
          !data.invoice ||
          isDismissedForSession(tenantId, data.invoice.id)
        ) {
          onClose();
          return;
        }
        setDunning(data);
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
  }, [open, token, tenantId, onClose]);

  const handleDismiss = () => {
    if (tenantId && dunning?.invoice) {
      markDismissedForSession(tenantId, dunning.invoice.id);
    }
    onClose();
  };

  if (!open) return null;
  /** 연체 여부 API 응답 전·미납 없음이면 오버레이를 띄우지 않음 (로그인·새로고침 깜빡임 방지) */
  if (loading || (!dunning && !error)) return null;

  const inv = dunning?.invoice;
  const popup = dunning?.popup;
  const bankLine = dunning
    ? [dunning.bank.bankName, dunning.bank.accountNumber, dunning.bank.accountHolder]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="billing-dunning-title"
        aria-describedby="billing-dunning-desc"
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white">
          <h2 id="billing-dunning-title" className="text-base font-semibold">
            {popup?.title ?? '이용료 납부 안내'}
          </h2>
          <p className="mt-0.5 text-xs text-amber-50/95">
            {popup?.subtitle ?? '납부기한이 지난 청구가 있습니다'}
          </p>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : dunning && inv ? (
            <>
              <p id="billing-dunning-desc" className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {popup?.body ??
                  '청소비서 이용료를 아직 확인하지 못했습니다. 입금 후에도 반영까지 시간이 걸릴 수 있습니다.'}
              </p>

              <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-sm space-y-1.5">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-gray-600">청구 금액</span>
                  <span className="font-semibold tabular-nums text-gray-900">
                    {inv.amountKrw.toLocaleString('ko-KR')}원
                    <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="text-gray-500">납부기한</span>
                  <span className="text-gray-800">{formatKoDate(inv.dueDate)}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="text-gray-500">상태</span>
                  <span className="font-medium text-amber-900">
                    {TENANT_INVOICE_STATUS_LABEL[inv.status as keyof typeof TENANT_INVOICE_STATUS_LABEL] ??
                      inv.status}
                  </span>
                </div>
              </div>

              {dunning.daysUntilBlock != null && dunning.daysUntilBlock > 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-950">
                  <p className="font-medium">
                    {formatDunningBlockSoonText(
                      popup?.blockSoonText ?? '{days}일 후 업무 접속이 제한됩니다',
                      dunning.daysUntilBlock,
                    )}
                  </p>
                  {dunning.accessBlockAt ? (
                    <p className="mt-1 text-xs text-rose-800/90">
                      제한 예정: {formatKoDateTime(dunning.accessBlockAt)} (유예 {dunning.overdueGraceDays}일)
                    </p>
                  ) : null}
                </div>
              ) : dunning.daysUntilBlock === 0 ? (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-900">
                  {popup?.blockTodayText ??
                    '오늘 중 업무 접속이 제한될 수 있습니다. 즉시 납부해 주세요.'}
                </div>
              ) : null}

              {bankLine ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                  <p className="text-xs font-medium text-gray-500">입금 계좌</p>
                  <p className="mt-1 text-gray-900">{bankLine}</p>
                  {dunning.bank.paymentGuideText ? (
                    <p className="mt-1.5 text-xs text-gray-600 whitespace-pre-wrap">
                      {dunning.bank.paymentGuideText}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {token && inv && dunning.paymentConfirmationEnabled ? (
                <BillingPaymentConfirmationRequestButton
                  token={token}
                  invoiceId={inv.id}
                  className="pt-0.5"
                />
              ) : null}
            </>
          ) : null}

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <Link
              to="/admin/team-leaders/company-profile/subscription"
              onClick={handleDismiss}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              이용료 상세 보기
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
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
