import { useEffect, useState } from 'react';
import { listOperatingCompanies, type OperatingCompanyItem } from '../api/operatingCompanies';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { token: string; items: OperatingCompanyItem[]; loadedAt: number } | null = null;

/** 영업 브랜드 목록 — 세션 내 짧은 TTL 캐시(정산·월정산표 등 중복 GET 방지) */
export function useOperatingCompanies(token: string | null): OperatingCompanyItem[] {
  const [items, setItems] = useState<OperatingCompanyItem[]>(() =>
    token && cache?.token === token ? cache.items : [],
  );

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    if (cache?.token === token && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
      setItems(cache.items);
      return;
    }
    let cancelled = false;
    void listOperatingCompanies(token)
      .then((r) => {
        if (cancelled) return;
        const next = r.items ?? [];
        cache = { token, items: next, loadedAt: Date.now() };
        setItems(next);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return items;
}

/** 정산·브랜드 변경 후 캐시 무효화 */
export function invalidateOperatingCompaniesCache(): void {
  cache = null;
}
