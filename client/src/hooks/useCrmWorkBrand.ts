import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToken } from '../stores/auth';
import {
  fetchMyOperatingCompanies,
  type MyOperatingCompanyItem,
} from '../api/operatingCompanies';
import { CRM_WORK_BRAND_SLUG_STORAGE_KEY } from '../utils/crmWorkBrandQuery';

export type CrmWorkBrandActive = MyOperatingCompanyItem & {
  operatingCompanyId: string;
};

export function useCrmWorkBrand() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MyOperatingCompanyItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchMyOperatingCompanies(token)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setIsAdmin(res.isAdmin);
        setLoadError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : '브랜드 목록을 불러오지 못했습니다.');
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workBrandSlugFromUrl = (searchParams.get('workBrand') ?? '').trim().toLowerCase();

  const active = useMemo((): CrmWorkBrandActive | null => {
    if (items.length === 0) return null;
    const pick = (slug: string) => items.find((i) => i.slug === slug);
    if (workBrandSlugFromUrl) {
      const byUrl = pick(workBrandSlugFromUrl);
      if (byUrl) return { ...byUrl, operatingCompanyId: byUrl.operatingCompanyId };
    }
    try {
      const stored = sessionStorage.getItem(CRM_WORK_BRAND_SLUG_STORAGE_KEY)?.trim().toLowerCase();
      if (stored) {
        const byStored = pick(stored);
        if (byStored) return { ...byStored, operatingCompanyId: byStored.operatingCompanyId };
      }
    } catch {
      /* ignore */
    }
    const primary = items.find((i) => i.isPrimary) ?? items[0];
    return primary ? { ...primary, operatingCompanyId: primary.operatingCompanyId } : null;
  }, [items, workBrandSlugFromUrl]);

  useEffect(() => {
    if (!active || loading) return;
    if (workBrandSlugFromUrl !== active.slug) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('workBrand', active.slug);
          return next;
        },
        { replace: true },
      );
    }
    try {
      sessionStorage.setItem(CRM_WORK_BRAND_SLUG_STORAGE_KEY, active.slug);
    } catch {
      /* ignore */
    }
  }, [active, loading, setSearchParams, workBrandSlugFromUrl]);

  const switchBrand = useCallback(
    (slug: string) => {
      const normalized = slug.trim().toLowerCase();
      if (!normalized) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('workBrand', normalized);
          return next;
        },
        { replace: false },
      );
      try {
        sessionStorage.setItem(CRM_WORK_BRAND_SLUG_STORAGE_KEY, normalized);
      } catch {
        /* ignore */
      }
    },
    [setSearchParams],
  );

  const showSwitcher = !loading && items.length > 1;

  return {
    loading,
    loadError,
    items,
    isAdmin,
    active,
    activeOperatingCompanyId: active?.operatingCompanyId ?? null,
    switchBrand,
    showSwitcher,
  };
}
