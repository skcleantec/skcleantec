import { useCallback, useEffect, useState } from 'react';
import { fetchBankDepositSummary } from '../../api/bankDeposits';
import { getToken } from '../../stores/auth';

const listeners = new Set<() => void>();

/** 입금이 들어오거나 연결이 바뀌면 메뉴의 「확인 필요」 숫자를 다시 센다. */
export function notifyBankDepositNavBadgeRefresh(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('cbiseo:bank-deposit', () => notifyBankDepositNavBadgeRefresh());
}

/** 서비스접수 › 입금 확인 메뉴 배지 — 아직 주인을 못 찾은 입금 수 */
export function useBankDepositNavBadge(enabled = true): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    const token = getToken();
    if (!enabled || !token) {
      setCount(0);
      return;
    }
    try {
      const r = await fetchBankDepositSummary(token);
      setCount(Number.isFinite(r.needsReviewCount) ? r.needsReviewCount : 0);
    } catch {
      /* 배지가 없어도 메뉴는 쓴다 */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const fn = () => void refresh();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, [enabled, refresh]);

  return count;
}
