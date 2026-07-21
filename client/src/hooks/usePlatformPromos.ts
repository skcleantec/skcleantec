import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminActivePlatformPromos,
  fetchTeamActivePlatformPromos,
  type PlatformPromoActiveItem,
} from '../api/platformPartnerPromo';

export function usePlatformPromos(surface: 'admin' | 'team') {
  const [items, setItems] = useState<PlatformPromoActiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows =
        surface === 'admin' ? await fetchAdminActivePlatformPromos() : await fetchTeamActivePlatformPromos();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [surface]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

export function filterPromosForMobile(items: PlatformPromoActiveItem[]): PlatformPromoActiveItem[] {
  return items.filter((item) => item.showOnMobile && item.mobileImageUrl.trim());
}

export function filterPromosForDesktop(items: PlatformPromoActiveItem[]): PlatformPromoActiveItem[] {
  return items.filter((item) => item.showOnDesktop && item.desktopImageUrl.trim());
}
