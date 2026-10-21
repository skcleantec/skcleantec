import { useState } from 'react';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { TeamNaviLaunchButton } from '../../team/TeamNaviLaunchButton';
import { useHasTenantFeature } from '../../../hooks/useTenantCapabilities';
import { InquiryCardPayLaunch } from './InquiryCardPayLaunch';

/** 접수 수정 하단. 카드결재·길안내는 접혀 있고, 누르면 버튼이 올라온다. */
export function InquiryEditFooterTools({ inquiryId, token }: { inquiryId: string; token: string }) {
  const cardPay = useHasTenantFeature('mod_card_payment');
  const [open, setOpen] = useState(false);
  const label = cardPay ? '카드결재, 길안내' : '길안내';

  return (
    <div className="mb-1">
      {open ? (
        <div className="mb-1.5 space-y-2">
          <InquiryCardPayLaunch inquiryId={inquiryId} token={token} />
          <TeamNaviLaunchButton inquiryId={inquiryId} token={token} variant="bar" destinationApi="staff" />
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-9 w-full items-center justify-center gap-1 rounded-lg text-fluid-2xs text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <LineMdIcon name={open ? 'chevron-down' : 'chevron-up'} className="size-4 shrink-0" />
        <span>{label}</span>
      </button>
    </div>
  );
}
