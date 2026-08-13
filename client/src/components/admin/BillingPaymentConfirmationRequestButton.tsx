import { useState } from 'react';
import { requestTenantPaymentConfirmation } from '../../api/tenantBilling';

const DEFAULT_HELP =
  '입금하셨다면 운영팀에 알림만 보냅니다. 결제 완료 처리는 별도로 진행되며, 업체 이메일로는 발송되지 않습니다.';

type Props = {
  token: string;
  invoiceId: string;
  enabled?: boolean;
  className?: string;
  variant?: 'primary' | 'outline';
  helpText?: string;
  showHelp?: boolean;
};

export function BillingPaymentConfirmationRequestButton({
  token,
  invoiceId,
  enabled = true,
  className = '',
  variant = 'outline',
  helpText = DEFAULT_HELP,
  showHelp = true,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const baseClass =
    variant === 'primary'
      ? 'rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
      : 'rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

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
      {showHelp && helpText ? (
        <p className="mb-2 text-xs text-gray-600 leading-relaxed">{helpText}</p>
      ) : null}
      <button type="button" disabled={!enabled || loading} onClick={() => void handleClick()} className={baseClass}>
        {loading ? '요청 중…' : '입금확인 요청 (운영팀 알림)'}
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
