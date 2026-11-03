import { useState } from 'react';
import type { OrderFollowupHotMark } from '../../../api/orderFollowups';
import { getToken } from '../../../stores/auth';
import { HotMarkIntakeButton } from '../../ui/FollowupHotMarkUi';
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

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <HotMarkIntakeButton
        marked={Boolean(pending)}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
      />
      {pending ? (
        <span className="text-fluid-2xs leading-snug text-slate-500">저장하면 내 가망에 들어가요</span>
      ) : null}
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
