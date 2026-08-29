import { useCallback, useEffect, useState } from 'react';
import { useVisibilityInterval } from './useVisibilityInterval';
import {
  fetchAdminActivePlatformPromos,
  fetchTeamActivePlatformPromos,
  type PlatformPromoActiveItem,
} from '../api/platformPartnerPromo';
import {
  platformPromoTeamMenuFromPath,
  promoVisibleOnTeamMenu,
  type PlatformPromoTeamMenu,
} from '@shared/platformPromoTeamSurfaces';

export function usePlatformPromos(surface: 'admin' | 'team', teamPreviewSearch = '') {
  const [items, setItems] = useState<PlatformPromoActiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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

  /** 플랫폼 배너 변경 후 탭 복귀·WebView 전환 시 목록 재조회 (API private cache 60s 보완) */
  useVisibilityInterval(refresh, 45_000);

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
