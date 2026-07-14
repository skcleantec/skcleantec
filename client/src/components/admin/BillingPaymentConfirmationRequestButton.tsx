import { useState } from 'react';
import { requestTenantPaymentConfirmation } from '../../api/tenantBilling';

type Props = {
  token: string;
  invoiceId: string;
  enabled?: boolean;
  className?: string;
  variant?: 'primary' | 'outline';
};

export function BillingPaymentConfirmationRequestButton({
  token,
  invoiceId,
  enabled = true,
  className = '',
  variant = 'outline',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const baseClass =
    variant === 'primary'
      ? 'rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50'
      : 'rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50';

  const handleClick = async () => {
    if (!enabled || loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const result = await requestTenantPaymentConfirmation(token, invoiceId);
      setFeedback({ type: 'ok', text: result.message });
    } catch (e) {
      setFeedback({
        type: 'err',
        text: e instanceof Error ? e.message : '입금 확인 요청에 실패했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button type="button" disabled={!enabled || loading} onClick={() => void handleClick()} className={baseClass}>
        {loading ? '요청 중…' : '입금확인 요청'}
      </button>
      {feedback ? (
        <p
          className={`mt-1.5 text-xs ${feedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
