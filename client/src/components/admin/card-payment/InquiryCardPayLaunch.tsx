import { useCallback, useState } from 'react';
import { fetchCardPaymentPrefill } from '../../../api/cardPayment';
import { TeamCardPaymentPgRequiredDialog } from '../../team/card-payment/TeamCardPaymentPgRequiredDialog';
import { STAFF_INQUIRY_CARD_PAY_PATH } from '../../../constants/teamCardPayment';
import { useHasTenantFeature } from '../../../hooks/useTenantCapabilities';

/** 접수 수정에서 팀장과 같은 수기·인증 결재를 연다. 목록·PG 설정은 열지 않는다. */
export function InquiryCardPayLaunch({ inquiryId, token }: { inquiryId: string; token: string }) {
  const enabled = useHasTenantFeature('mod_card_payment');
  const [checking, setChecking] = useState(false);
  const [pgRequired, setPgRequired] = useState(false);

  const open = useCallback(() => {
    if (!token || checking) return;
    setChecking(true);
    void fetchCardPaymentPrefill(token, inquiryId)
      .then((res) => {
        if (!res.pgConnected) {
          setPgRequired(true);
          return;
        }
        const q = new URLSearchParams({ inquiryId });
        window.open(`${STAFF_INQUIRY_CARD_PAY_PATH}?${q}`, '_blank', 'noopener,noreferrer');
      })
      .catch(() => setPgRequired(true))
      .finally(() => setChecking(false));
  }, [checking, inquiryId, token]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={checking}
        className="flex min-h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {checking ? '확인 중' : '카드결재'}
      </button>
      <TeamCardPaymentPgRequiredDialog open={pgRequired} onClose={() => setPgRequired(false)} />
    </>
  );
}
