import { useCallback, useEffect, useState } from 'react';
import {
  getFormConfig,
  listBrandCustomerLinkConfigs,
} from '../api/orderform';
import {
  brandCustomerLinkConfigMapFromItems,
  normalizeMsgConfigForEditor,
  type BrandCustomerLinkMsgConfigMap,
  type FormMessagesState,
} from '../utils/orderFormCustomerCopy';

type CacheEntry = {
  token: string;
  map: BrandCustomerLinkMsgConfigMap;
  tenantFallback: FormMessagesState;
  loadedAt: number;
};

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

/** 브랜드별 고객 링크 메시지 설정 — 메시지 복사·발급 시 사용 */
export function useOrderFormBrandCustomerLinkConfigs(token: string | null): {
  map: BrandCustomerLinkMsgConfigMap;
  tenantFallback: FormMessagesState | null;
  loading: boolean;
  refresh: () => void;
} {
  const [map, setMap] = useState<BrandCustomerLinkMsgConfigMap>(() =>
    token && cache?.token === token ? cache.map : {},
  );
  const [tenantFallback, setTenantFallback] = useState<FormMessagesState | null>(() =>
    token && cache?.token === token ? cache.tenantFallback : null,
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!token) {
      setMap({});
      setTenantFallback(null);
      return;
    }
    if (cache?.token === token && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
      setMap(cache.map);
      setTenantFallback(cache.tenantFallback);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all([listBrandCustomerLinkConfigs(token), getFormConfig(token)])
      .then(([listRes, tenantCfg]) => {
        if (cancelled) return;
        const nextMap = brandCustomerLinkConfigMapFromItems(listRes.items);
        const fallback = normalizeMsgConfigForEditor(tenantCfg);
        cache = { token, map: nextMap, tenantFallback: fallback, loadedAt: Date.now() };
        setMap(nextMap);
        setTenantFallback(fallback);
      })
      .catch(() => {
        if (!cancelled) {
          setMap({});
          setTenantFallback(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const refresh = useCallback(() => {
    if (token) cache = null;
    load();
  }, [load, token]);

  return { map, tenantFallback, loading, refresh };
}

export function invalidateOrderFormBrandCustomerLinkConfigCache(): void {
  cache = null;
}
