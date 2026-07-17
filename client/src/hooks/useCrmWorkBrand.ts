import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToken, subscribeAdminAuth } from '../stores/auth';
import {
  fetchMyOperatingCompanies,
  type MyOperatingCompanyItem,
} from '../api/operatingCompanies';
import {
  readCrmWorkBrandStoredSlug,
  writeCrmWorkBrandStoredSlug,
} from '../utils/crmWorkBrandQuery';
import { parseJwtPayload } from '../utils/jwtPayload';

export type CrmWorkBrandActive = MyOperatingCompanyItem & {
  operatingCompanyId: string;
};

function toActive(item: MyOperatingCompanyItem): CrmWorkBrandActive {
  return { ...item, operatingCompanyId: item.operatingCompanyId };
}

function resolveCrmWorkBrandActive(params: {
  items: MyOperatingCompanyItem[];
  workBrandSlugFromUrl: string;
  storedSlug: string | null;
  isAdmin: boolean;
}): CrmWorkBrandActive | null {
  const { items, workBrandSlugFromUrl, storedSlug, isAdmin } = params;
  if (items.length === 0) return null;
  const pick = (slug: string) => items.find((i) => i.slug === slug);

  if (workBrandSlugFromUrl) {
    const byUrl = pick(workBrandSlugFromUrl);
    if (byUrl) return toActive(byUrl);
  }

  if (isAdmin) {
    if (storedSlug) {
      const byStored = pick(storedSlug);
      if (byStored) return toActive(byStored);
    }
    const primary = items.find((i) => i.isPrimary) ?? items[0];
    return primary ? toActive(primary) : null;
  }

  // 마케터·팀장: 본인 세션 저장 → 소속 primary (타 계정 legacy slug는 read에서 제외됨)
  if (storedSlug) {
    const byStored = pick(storedSlug);
    if (byStored) return toActive(byStored);
  }

  const membershipPrimary = items.find((i) => i.isPrimary);
  if (membershipPrimary) return toActive(membershipPrimary);

  const fallback = items[0];
  return fallback ? toActive(fallback) : null;
}

export function useCrmWorkBrand() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const authUserId = useMemo(() => {
    if (!token) return null;
    return parseJwtPayload<{ userId?: string }>(token)?.userId ?? null;
  }, [token]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MyOperatingCompanyItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setItems([]);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
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
        setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const workBrandSlugFromUrl = (searchParams.get('workBrand') ?? '').trim().toLowerCase();
  const storedSlug = useMemo(
    () => readCrmWorkBrandStoredSlug(authUserId),
    [authUserId, workBrandSlugFromUrl],
  );

  const active = useMemo((): CrmWorkBrandActive | null => {
    return resolveCrmWorkBrandActive({
      items,
      workBrandSlugFromUrl,
      storedSlug,
      isAdmin,
    });
  }, [items, workBrandSlugFromUrl, storedSlug, isAdmin]);

  useEffect(() => {
    if (!active || loading || !authUserId) return;
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
    writeCrmWorkBrandStoredSlug(authUserId, active.slug);
  }, [active, authUserId, loading, setSearchParams, workBrandSlugFromUrl]);

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
      writeCrmWorkBrandStoredSlug(authUserId, normalized);
    },
    [authUserId, setSearchParams],
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
