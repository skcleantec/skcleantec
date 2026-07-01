import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../stores/auth';
import { fetchTelecrmCustomerLookup, type TelecrmCustomerLookupDto } from '../api/telecrm';

export function useCrmCustomerLookup(phone: string, enabled: boolean) {
  const [data, setData] = useState<TelecrmCustomerLookupDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const lookup = useCallback(async (rawPhone: string) => {
    const token = getToken();
    const trimmed = rawPhone.trim();
    if (!token || trimmed.length < 4) {
      setData(null);
      setError(null);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmCustomerLookup(token, trimmed);
      if (reqId !== reqRef.current) return;
      setData(res);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      setError(e instanceof Error ? e.message : '조회 실패');
      setData(null);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => void lookup(phone), 400);
    return () => window.clearTimeout(t);
  }, [phone, enabled, lookup]);

  return { data, loading, error, refresh: () => void lookup(phone) };
}
