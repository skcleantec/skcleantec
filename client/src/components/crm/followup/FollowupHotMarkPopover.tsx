import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  deleteOrderFollowupHotMark,
  saveOrderFollowupHotMark,
  type OrderFollowupHotMark,
} from '../../../api/orderFollowups';
import { HotChipButton, HotTextButton } from '../../ui/FollowupHotMarkUi';
import { HOT_MARK_REASONS, type HotMarkReasonId, hotWhenPresets } from '../../../utils/orderFollowupHotMark';

export function FollowupHotMarkPopover({
  token,
  followupId,
  current,
  anchor,
  onClose,
  onSaved,
}: {
  token: string;
  followupId: string;
  current: OrderFollowupHotMark | null;
  anchor: DOMRect;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState<HotMarkReasonId | ''>(
    (HOT_MARK_REASONS.some((row) => row.id === current?.reason) ? current?.reason : '') as HotMarkReasonId | '',
  );
  const [memo, setMemo] = useState(current?.memo ?? '');
  const [whenId, setWhenId] = useState(current?.nextContactAt ? 'custom' : '');
  const [customLocal, setCustomLocal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = hotWhenPresets();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nextContactAt = (): string | null => {
    if (whenId === 'custom') {
      if (!customLocal) return current?.nextContactAt ?? null;
      const date = new Date(customLocal);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    return presets.find((row) => row.id === whenId)?.at ?? current?.nextContactAt ?? null;
  };

  const save = async () => {
    if (!reason) {
      setError('이유를 선택해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveOrderFollowupHotMark(token, followupId, {
        reason,
        memo: memo.trim() || null,
        nextContactAt: nextContactAt(),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteOrderFollowupHotMark(token, followupId);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '표시를 해제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const top = Math.min(anchor.bottom + 6, window.innerHeight - 280);
  const left = Math.min(anchor.left, window.innerWidth - 300);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80]" onClick={onClose} />
      <div
        className="fixed z-[90] w-[min(18rem,calc(100vw-1rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        style={{ top, left }}
        role="dialog"
        aria-label="내 가망 표시"
      >
        <p className="px-0.5 text-fluid-2xs font-semibold text-slate-500">이유</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {HOT_MARK_REASONS.map((row) => (
            <HotChipButton key={row.id} active={reason === row.id} onClick={() => setReason(row.id)}>
              {row.label}
            </HotChipButton>
          ))}
        </div>
        <p className="mt-2 px-0.5 text-fluid-2xs font-semibold text-slate-500">다음 연락</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {presets.map((row) => (
            <HotChipButton key={row.id} active={whenId === row.id} onClick={() => setWhenId(row.id)}>
              {row.label}
            </HotChipButton>
          ))}
          <HotChipButton active={whenId === 'custom'} onClick={() => setWhenId('custom')}>
            직접
          </HotChipButton>
        </div>
        {whenId === 'custom' ? (
          <input
            type="datetime-local"
            value={customLocal}
            onChange={(event) => setCustomLocal(event.target.value)}
            className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-fluid-xs text-slate-800"
          />
        ) : null}
        <input
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="한 줄 메모"
          maxLength={200}
          className="mt-2 h-8 w-full rounded-lg border border-slate-200 px-2 text-fluid-xs text-slate-800"
        />
        {error ? <p className="mt-1 text-fluid-2xs text-[#b42318]">{error}</p> : null}
        <div className="mt-2 flex gap-1">
          <HotTextButton disabled={busy} onClick={() => void save()} className="flex-1">
            저장
          </HotTextButton>
          {current ? (
            <HotTextButton tone="danger" disabled={busy} onClick={() => void clear()}>
              표시 해제
            </HotTextButton>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}
