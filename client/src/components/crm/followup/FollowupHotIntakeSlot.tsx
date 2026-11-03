import { useState } from 'react';
import type { OrderFollowupHotMark } from '../../../api/orderFollowups';
import { getToken } from '../../../stores/auth';
import { HotMarkIntakeButton } from '../../ui/FollowupHotMarkUi';
import { formatHotWhen, hotReasonLabel } from '../../../utils/orderFollowupHotMark';
import { FollowupHotIntakeBanner } from './FollowupHotIntakeBanner';
import { FollowupHotMarkPopover, type HotMarkDraft } from './FollowupHotMarkPopover';

export function FollowupHotIntakeSlot({
  followupId,
  mark,
  editable = true,
  pending,
  onPendingChange,
  onServerMark,
  disabled = false,
}: {
  followupId: string | null;
  mark: OrderFollowupHotMark | null;
  editable?: boolean;
  pending: HotMarkDraft | null;
  onPendingChange: (draft: HotMarkDraft | null) => void;
  onServerMark: (mark: OrderFollowupHotMark | null) => void;
  disabled?: boolean;
}) {
  const token = getToken();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  if (followupId && mark) {
    return (
      <FollowupHotIntakeBanner followupId={followupId} mark={mark} editable={editable} />
    );
  }
  if (followupId && !editable) return null;
  if (!token) return null;

  const pendingMark: OrderFollowupHotMark | null = pending
    ? { reason: pending.reason, memo: pending.memo, nextContactAt: pending.nextContactAt, contactTries: 0 }
    : null;

  const when = pending ? formatHotWhen(pending.nextContactAt) : '';
  const pendingText = pending
    ? [hotReasonLabel(pending.reason), when].filter(Boolean).join(' · ')
    : null;

  return (
    <div>
      <HotMarkIntakeButton
        pendingText={pendingText}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
      />
      {anchor ? (
        <FollowupHotMarkPopover
          token={token}
          followupId={followupId}
          current={followupId ? mark : pendingMark}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onSaved={onServerMark}
          onDraft={onPendingChange}
        />
      ) : null}
    </div>
  );
}
