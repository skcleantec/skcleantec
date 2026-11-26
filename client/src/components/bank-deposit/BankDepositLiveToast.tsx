import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchBankDepositSettings } from '../../api/bankDeposits';
import { useBankDepositRealtime, type BankDepositRtPayload } from '../../hooks/useBankDepositRealtime';
import { DEPOSIT_KIND_LABEL, won } from './bankDepositFormat';

type ToastItem = BankDepositRtPayload & { key: number };
const SHOW_MS = 9000;
const seenIds = new Set<string>();

/**
 * 입금이 들어온 순간 화면 오른쪽 아래에 알린다.
 * 같은 입금의 연결·끊기 같은 뒤따르는 변경은 다시 알리지 않는다.
 */
export function BankDepositLiveToast({
  token,
  enabled,
  onOpen,
  className = '',
}: {
  token: string | null;
  enabled: boolean;
  /** 알림을 눌렀을 때 — 입금 확인 화면 열기 */
  onOpen: () => void;
  className?: string;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [muted, setMuted] = useState(false);

  // 업체 설정에서 사무실 화면 알림을 껐으면 띄우지 않는다. 설정을 못 읽으면 띄운다.
  useEffect(() => {
    if (!enabled || !token) return;
    let cancelled = false;
    const read = () =>
      fetchBankDepositSettings(token)
        .then((r) => {
          if (!cancelled) setMuted(r.settings.staffToastEnabled === false);
        })
        .catch(() => {});
    void read();
    const onChanged = () => void read();
    window.addEventListener('cbiseo:bank-deposit-settings', onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('cbiseo:bank-deposit-settings', onChanged);
    };
  }, [enabled, token]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const dismiss = (key: number) => {
    const t = timers.current.get(key);
    if (t) clearTimeout(t);
    timers.current.delete(key);
    setItems((prev) => prev.filter((x) => x.key !== key));
  };

  useBankDepositRealtime(
    token,
    (p) => {
      const isNew = p.event ? p.event === 'new' : !seenIds.has(p.id);
      seenIds.add(p.id);
      if (p.muted) return; // 고정 입금처는 조용히
      // 팀장 확인·주인 없음은 뒤따르는 변경이어도 알린다.
      const teamNews = Boolean(p.noOwner || p.claimedByTeamLeaderName);
      if (!isNew && !teamNews) return;
      if (!teamNews && p.status !== 'AUTO_LINKED' && p.status !== 'NEEDS_REVIEW') return;
      seq.current += 1;
      const key = seq.current;
      setItems((prev) => [...prev.slice(-2), { ...p, key }]);
      timers.current.set(
        key,
        setTimeout(() => dismiss(key), SHOW_MS),
      );
    },
    enabled && Boolean(token) && !muted,
  );

  if (items.length === 0 || muted) return null;

  return createPortal(
    <div className={`fixed bottom-4 right-4 z-[70] flex w-[min(320px,calc(100vw-32px))] flex-col gap-2 ${className}`} role="status" aria-live="polite">
      {items.map((item) => {
        const auto = item.status === 'AUTO_LINKED' || Boolean(item.claimedByTeamLeaderName);
        const headline = item.noOwner
          ? '주인을 못 찾은 입금이 있어요'
          : item.claimedByTeamLeaderName
            ? '팀장이 입금을 확인했어요'
            : '입금이 들어왔어요';
        return (
          <div
            key={item.key}
            className={`flex items-stretch overflow-hidden rounded-xl border bg-white shadow-lg ${auto ? 'border-emerald-200' : 'border-amber-300'}`}
          >
            <span className={`w-1.5 shrink-0 ${auto ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden />
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-slate-50">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                {headline}
                {item.operatingCompanyName ? (
                  <span className="rounded bg-slate-100 px-1.5 py-px text-[10.5px] font-bold text-slate-700">{item.operatingCompanyName}</span>
                ) : null}
              </span>
              <span className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-fluid-base font-extrabold tabular-nums text-slate-900">{won(item.amountWon)}</span>
                <span className="min-w-0 truncate text-fluid-xs font-semibold text-slate-800">
                  {item.customerName || item.depositorName || '입금자명 없음'}
                </span>
              </span>
              {item.customerName && item.depositorName && item.customerName !== item.depositorName ? (
                <span className="block truncate text-fluid-2xs text-slate-500">입금자 {item.depositorName}</span>
              ) : null}
              <span className={`mt-0.5 block text-fluid-2xs ${auto ? 'text-emerald-800' : 'text-amber-900'}`}>
                {item.noOwner
                  ? '팀장 모두 내 건이 아니라고 했어요. 사무실에서 확인해 주세요'
                  : item.claimedByTeamLeaderName
                    ? `${item.claimedByTeamLeaderName} 팀장이 ${item.linkedKind ? DEPOSIT_KIND_LABEL[item.linkedKind] : '잔금'}으로 연결했어요`
                    : auto
                  ? `${item.linkedKind ? DEPOSIT_KIND_LABEL[item.linkedKind] : '접수'}으로 자동 연결됐어요${
                      item.marketerName ? ` · 담당 ${item.marketerName}` : ''
                    }`
                  : '누구 입금인지 확인이 필요해요'}
              </span>
            </button>
            <button
              type="button"
              aria-label="알림 닫기"
              onClick={() => dismiss(item.key)}
              className="shrink-0 px-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
