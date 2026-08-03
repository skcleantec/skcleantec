import { useEffect, useMemo, useState } from 'react';
import {
  fetchMyOperatingCompanies,
  type MyOperatingCompanyItem,
} from '../api/operatingCompanies';

/** 발주서 발급 — 선택 가능한 영업 브랜드 (관리자면 전체, 아니면 소속만) */
export function useOrderIssueOperatingCompanies(token: string | null) {
  const [loading, setLoading] = useState(Boolean(token));
  const [items, setItems] = useState<MyOperatingCompanyItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setItems([]);
      setIsAdmin(false);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchMyOperatingCompanies(token)
      .then((res) => {
        if (cancelled) return;
        const active = res.items.filter((oc) => oc.isActive !== false);
        setItems(active);
        setIsAdmin(res.isAdmin);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setItems([]);
        setIsAdmin(false);
        setError(e instanceof Error ? e.message : '영업 브랜드 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const defaultOperatingCompanyId = useMemo(() => {
    if (items.length === 0) return '';
    const primary = items.find((oc) => oc.isPrimary);
    if (primary) return primary.operatingCompanyId;
    const def = items.find((oc) => oc.isDefault);
    if (def) return def.operatingCompanyId;
    return items[0]?.operatingCompanyId ?? '';
  }, [items]);

  return {
    loading,
    error,
    items,
    isAdmin,
    defaultOperatingCompanyId,
  };
}
