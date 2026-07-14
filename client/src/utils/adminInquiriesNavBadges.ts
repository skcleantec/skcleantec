import { useCallback, useEffect, useState } from 'react';
import { getAdminNavBadges } from '../api/adminNavBadges';
import { getToken } from '../stores/auth';

const listeners = new Set<() => void>();

/** GNB 배지 갱신(AdminLayout)과 서비스접수·문의내역 하위 메뉴 배지 동기 */
export function notifyInquiriesSubNavBadgesRefresh(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeInquiriesSubNavBadgesRefresh(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type InquiriesSubNavBadges = {
  reviewPaybackUnseenCount: number;
  csPendingCount: number;
  leadsPendingCount: number;
};

const EMPTY_BADGES: InquiriesSubNavBadges = {
  reviewPaybackUnseenCount: 0,
  csPendingCount: 0,
  leadsPendingCount: 0,
};

/** 서비스접수 하위 메뉴(페이백·C/S·문의내역) 배지 */
export function useInquiriesSubNavBadges(enabled = true) {
  const [badges, setBadges] = useState<InquiriesSubNavBadges>(EMPTY_BADGES);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setBadges(EMPTY_BADGES);
      return;
    }
    const token = getToken();
    if (!token) {
      setBadges(EMPTY_BADGES);
      return;
    }
    try {
      const r = await getAdminNavBadges(token);
      setBadges({
        reviewPaybackUnseenCount: r.reviewPaybackUnseenCount,
        csPendingCount: r.csPendingCount,
        leadsPendingCount: r.leadsPendingCount,
      });
    } catch {
      /* ignore */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return subscribeInquiriesSubNavBadgesRefresh(() => {
      void refresh();
    });
  }, [enabled, refresh]);

  return { badges, refresh };
}

/** 문의내역(랜딩 문의) 탭 전용 — 하위 레이아웃에서 재사용 */
export function useLeadsPendingNavBadge(enabled = true) {
  const { badges } = useInquiriesSubNavBadges(enabled);
  return { count: badges.leadsPendingCount };
}
