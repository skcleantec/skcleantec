import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../stores/auth';
import { fetchTelecrmCustomerLookup, type TelecrmCustomerLookupDto } from '../api/telecrm';

export type CrmCustomerSearchMode = 'phone' | 'name';

const LOOKUP_TIMEOUT_MS = 25_000;

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

  const runLookup = useCallback(
    async (mode: CrmCustomerSearchMode, text: string) => {
      const reqId = ++reqRef.current;
      setLoading(true);
      setError(null);

      const token = getToken();
      const trimmed = text.trim();
      const minLen = mode === 'phone' ? 4 : 2;

      if (!enabled || !token || !operatingCompanyId || trimmed.length < minLen) {
        if (reqId === reqRef.current) {
          setData(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        if (reqId === reqRef.current) {
          setError('고객 이력 조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
          setData(null);
          setLoading(false);
          reqRef.current += 1;
        }
      }, LOOKUP_TIMEOUT_MS);

      try {
        const res = await fetchTelecrmCustomerLookup(
          token,
          mode === 'phone' ? { phone: trimmed } : { name: trimmed },
          operatingCompanyId,
        );
        if (timedOut || reqId !== reqRef.current) return;
        setData(res);
      } catch (e) {
        if (timedOut || reqId !== reqRef.current) return;
        setError(e instanceof Error ? e.message : '조회 실패');
        setData(null);
      } finally {
        window.clearTimeout(timeoutId);
        if (!timedOut && reqId === reqRef.current) setLoading(false);
      }
    },
    [enabled, operatingCompanyId],
  );

  useEffect(() => {
    if (!enabled) {
      reqRef.current += 1;
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    const t = window.setTimeout(() => void runLookup(searchMode, searchText), 400);
    return () => window.clearTimeout(t);
  }, [searchMode, searchText, enabled, runLookup]);

  const refresh = useCallback(() => void runLookup(searchMode, searchText), [runLookup, searchMode, searchText]);

  const resolveByPhone = useCallback((phone: string) => void runLookup('phone', phone), [runLookup]);

  return { data, loading, error, refresh, resolveByPhone };
}
