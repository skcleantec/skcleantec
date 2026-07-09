import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../stores/auth';
import { fetchTelecrmCustomerLookup, type TelecrmCustomerLookupDto } from '../api/telecrm';

export type CrmCustomerSearchMode = 'phone' | 'name';

export function useCrmCustomerLookup(
  searchMode: CrmCustomerSearchMode,
  searchText: string,
  enabled: boolean,
  operatingCompanyId?: string | null,
) {
  const [data, setData] = useState<TelecrmCustomerLookupDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const lookup = useCallback(
    async (mode: CrmCustomerSearchMode, text: string) => {
      const token = getToken();
      const trimmed = text.trim();
      const minLen = mode === 'phone' ? 4 : 2;
      if (!token || !operatingCompanyId || trimmed.length < minLen) {
        setData(null);
        setError(null);
        return;
      }
      const reqId = ++reqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTelecrmCustomerLookup(
          token,
          mode === 'phone' ? { phone: trimmed } : { name: trimmed },
          operatingCompanyId,
        );
        if (reqId !== reqRef.current) return;
        setData(res);
      } catch (e) {
        if (reqId !== reqRef.current) return;
        setError(e instanceof Error ? e.message : '조회 실패');
        setData(null);
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    },
    [operatingCompanyId],
  );

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => void lookup(searchMode, searchText), 400);
    return () => window.clearTimeout(t);
  }, [searchMode, searchText, enabled, lookup]);

  const refresh = useCallback(() => void lookup(searchMode, searchText), [lookup, searchMode, searchText]);

  const resolveByPhone = useCallback(
    async (phone: string) => {
      const token = getToken();
      const trimmed = phone.trim();
      if (!token || !operatingCompanyId || trimmed.length < 4) return;
      const reqId = ++reqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTelecrmCustomerLookup(token, { phone: trimmed }, operatingCompanyId);
        if (reqId !== reqRef.current) return;
        setData(res);
      } catch (e) {
        if (reqId !== reqRef.current) return;
        setError(e instanceof Error ? e.message : '조회 실패');
        setData(null);
      } finally {
        if (reqId === reqRef.current) setLoading(false);
      }
    },
    [operatingCompanyId],
  );

  return { data, loading, error, refresh, resolveByPhone };
}
