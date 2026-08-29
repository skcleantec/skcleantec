import { useCallback, useEffect, useState } from 'react';
import { useVisibilityInterval } from './useVisibilityInterval';
import {
  fetchAdminActivePlatformPromos,
  fetchTeamActivePlatformPromos,
  type PlatformPromoActiveItem,
} from '../api/platformPartnerPromo';
import { subscribeAdminAuth, getToken } from '../stores/auth';
import { subscribeTeamAuth, getTeamToken } from '../stores/teamAuth';
import { isCbiseoStaffNativeApp } from '../utils/cbiseoNativeApp';
import {
  platformPromoTeamMenuFromPath,
  promoVisibleOnTeamMenu,
  type PlatformPromoTeamMenu,
} from '@shared/platformPromoTeamSurfaces';

export function usePlatformPromos(surface: 'admin' | 'team', teamPreviewSearch = '') {
  const [items, setItems] = useState<PlatformPromoActiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const hasAuth =
      surface === 'admin' ? Boolean(getToken()) : Boolean(getTeamToken());
    if (!hasAuth) return;

    setLoading(true);
    try {
      const rows =
        surface === 'admin'
          ? await fetchAdminActivePlatformPromos()
          : await fetchTeamActivePlatformPromos(teamPreviewSearch);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [surface, teamPreviewSearch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Android WebView — native localStorage 주입이 fetch보다 늦을 수 있음 */
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const id = window.setInterval(() => {
      if (cancelled || attempts >= 20) {
        clearInterval(id);
        return;
      }
      attempts += 1;
      const hasAuth =
        surface === 'admin' ? Boolean(getToken()) : Boolean(getTeamToken());
      if (hasAuth) {
        void refresh();
        clearInterval(id);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [surface, refresh]);

  useEffect(() => {
    const unsub =
      surface === 'admin'
        ? subscribeAdminAuth(() => void refresh())
        : subscribeTeamAuth(() => void refresh());
    return unsub;
  }, [surface, refresh]);

  useEffect(() => {
    const onExternalRefresh = () => void refresh();
    const onSurfaceVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('cbiseo:inbox-refresh', onExternalRefresh);
    window.addEventListener('cbiseo:staff-resume', onExternalRefresh);
    window.addEventListener('focus', onExternalRefresh);
    window.addEventListener('pageshow', onExternalRefresh);
    document.addEventListener('visibilitychange', onSurfaceVisible);
    return () => {
      window.removeEventListener('cbiseo:inbox-refresh', onExternalRefresh);
      window.removeEventListener('cbiseo:staff-resume', onExternalRefresh);
      window.removeEventListener('focus', onExternalRefresh);
      window.removeEventListener('pageshow', onExternalRefresh);
      document.removeEventListener('visibilitychange', onSurfaceVisible);
    };
  }, [refresh]);

  const pollMs = isCbiseoStaffNativeApp() ? 8_000 : 45_000;
  useVisibilityInterval(refresh, pollMs);

  return { items, loading, refresh };
}

import {
  platformPromoHasBannerImage,
} from '@shared/platformPromoImageSpec';

export function filterPromosForMobile(items: PlatformPromoActiveItem[]): PlatformPromoActiveItem[] {
  return items.filter((item) => item.showOnMobile && platformPromoHasBannerImage(item));
}

export function filterPromosForDesktop(items: PlatformPromoActiveItem[]): PlatformPromoActiveItem[] {
  return items.filter((item) => item.showOnDesktop && platformPromoHasBannerImage(item));
}

export function filterPromosForTeamMenu(
  items: PlatformPromoActiveItem[],
  menu: PlatformPromoTeamMenu,
): PlatformPromoActiveItem[] {
  return items.filter((item) => promoVisibleOnTeamMenu(item, menu));
}

export function filterPromosForTeamPath(items: PlatformPromoActiveItem[], pathname: string): PlatformPromoActiveItem[] {
  const menu = platformPromoTeamMenuFromPath(pathname);
  if (!menu) return [];
  return filterPromosForTeamMenu(items, menu);
}

/** 자사 팀장 앱 — 테넌트 스태프 배너는 /team/dashboard 에서 타업체 메뉴 플래그 없이 노출 */
export function filterPromosForTeamLeaderPath(
  items: PlatformPromoActiveItem[],
  pathname: string,
): PlatformPromoActiveItem[] {
  if (pathname === '/team/dashboard') return items;
  return [];
}
