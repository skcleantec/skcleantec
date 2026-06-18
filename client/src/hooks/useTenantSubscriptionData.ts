import { useCallback, useEffect, useState } from 'react';
import { fetchTenantSubscription, type TenantSubscriptionDto } from '../api/tenantSubscription';
import { getToken } from '../stores/auth';

export function useTenantSubscriptionData() {
  const token = getToken();
  const [loading, setLoading] = useState(Boolean(token));
  const [data, setData] = useState<TenantSubscriptionDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTenantSubscription(token));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { token, loading, data, error, reload: load };
}
