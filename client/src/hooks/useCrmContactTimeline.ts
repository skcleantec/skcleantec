import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTelecrmContactTimeline, type TelecrmContactTimelineItemDto } from '../api/telecrm';
import {
  canSearchCrmContactTimeline,
  extractCrmRegionKey,
  type CrmContactIdentity,
} from '@shared/crmContactIdentity';
import { getToken } from '../stores/auth';

export function useCrmContactTimeline(
  identity: CrmContactIdentity,
  opts: {
    phone?: string;
    phone2?: string;
    operatingCompanyId?: string | null;
    enabled?: boolean;
    refreshKey?: number;
  } = {},
) {
  const { phone = '', phone2 = '', operatingCompanyId = null, enabled = true, refreshKey = 0 } = opts;
  const [items, setItems] = useState<TelecrmContactTimelineItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  const canSearch = enabled && canSearchCrmContactTimeline(identity);

  const reload = useCallback(async () => {
    const token = getToken();
    if (!token || !canSearch) {
      setItems([]);
      setError(null);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const region = extractCrmRegionKey(identity.address);
      const res = await fetchTelecrmContactTimeline(token, {
        customerName: identity.customerName.trim(),
        nickname: identity.nickname.trim(),
        region,
        address: identity.address.trim(),
        phone: phone.replace(/\D/g, '') || undefined,
        phone2: phone2.replace(/\D/g, '') || undefined,
        operatingCompanyId,
        limit: 50,
      });
      if (reqId !== reqRef.current) return;
      setItems(res.items);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      setError(e instanceof Error ? e.message : '접촉 이력을 불러올 수 없습니다.');
      setItems([]);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [canSearch, identity, phone, phone2, operatingCompanyId]);

  useEffect(() => {
    const t = window.setTimeout(() => void reload(), 350);
    return () => window.clearTimeout(t);
  }, [reload, refreshKey]);

  useEffect(() => {
    if (!canSearch) return;
    const id = window.setInterval(() => void reload(), 20000);
    return () => window.clearInterval(id);
  }, [canSearch, reload]);

  return { items, loading, error, reload, canSearch };
}
