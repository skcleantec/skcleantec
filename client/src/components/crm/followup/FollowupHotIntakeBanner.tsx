import { useState } from 'react';
import { recordOrderFollowupHotResult, type OrderFollowupHotMark } from '../../../api/orderFollowups';
import { getToken } from '../../../stores/auth';
import { HotChipButton, HotTextButton } from '../../ui/FollowupHotMarkUi';
import { formatHotWhen, hotReasonLabel, hotWhenPresets } from '../../../utils/orderFollowupHotMark';

export function FollowupHotIntakeBanner({
  followupId,
  mark,
  editable = true,
}: {
  followupId: string;
  mark: OrderFollowupHotMark;
  editable?: boolean;
}) {
  const token = getToken();
  const [current, setCurrent] = useState(mark);
  const [closed, setClosed] = useState<string | null>(null);
  const [pending, setPending] = useState<'NO_ANSWER' | 'THINKING' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (result: 'BOOKED' | 'NO_ANSWER' | 'THINKING' | 'DROPPED', nextContactAt?: string) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await recordOrderFollowupHotResult(token, followupId, { result, nextContactAt });
      if (!res.myHotMark) {
        setClosed(result === 'DROPPED' ? '포기' : '예약됨');
        setPending(null);
      } else {
        setCurrent(res.myHotMark);
        setPending(null);
      }
      window.dispatchEvent(new Event('crm-hot-summary-refresh'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '결과를 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (closed) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-fluid-xs text-slate-700">
        ⭐ 내 가망 · {closed}
      </p>
    );
  }

  const when = formatHotWhen(current.nextContactAt);

  return (
    <div className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-2 py-1.5">
      <p className="text-fluid-xs font-semibold text-slate-800">
        ⭐ 내 가망 · {hotReasonLabel(current.reason)}
        {when ? ` · ${when}` : ''} · 연락 {current.contactTries}회
      </p>
      {editable ? (
        <div className="mt-1 flex flex-wrap gap-1">
          <HotTextButton disabled={busy} onClick={() => void send('BOOKED')}>
            예약됨
          </HotTextButton>
          <HotTextButton tone="quiet" disabled={busy} onClick={() => setPending('NO_ANSWER')}>
            안 받음
          </HotTextButton>
          <HotTextButton tone="quiet" disabled={busy} onClick={() => setPending('THINKING')}>
            더 고민
          </HotTextButton>
          <HotTextButton tone="danger" disabled={busy} onClick={() => void send('DROPPED')}>
            포기
          </HotTextButton>
        </div>
      ) : null}
      {pending ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {hotWhenPresets().map((row) => (
            <HotChipButton key={row.id} disabled={busy} onClick={() => void send(pending, row.at)}>
              {row.label}
            </HotChipButton>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-fluid-2xs text-[#b42318]">{error}</p> : null}
    </div>
  );
}
