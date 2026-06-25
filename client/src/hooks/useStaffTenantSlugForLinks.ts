import { useEffect, useState } from 'react';
import { getMe } from '../api/auth';
import { resolveStaffTenantSlugForLinks } from '../utils/staffTenantSlugForLinks';

/** 스태ff 세션 tenant.slug → 고객 링크용 slug (apex SK Host 오염 방지) */
export function useStaffTenantSlugForLinks(token: string | null | undefined): string {
  const [sessionSlug, setSessionSlug] = useState('');

  useEffect(() => {
    if (!token) {
      setSessionSlug('');
      return;
    }
    let cancelled = false;
    void getMe(token)
      .then((u: { tenant?: { slug?: string } | null }) => {
        if (cancelled) return;
        setSessionSlug(typeof u.tenant?.slug === 'string' ? u.tenant.slug : '');
      })
      .catch(() => {
        if (!cancelled) setSessionSlug('');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return resolveStaffTenantSlugForLinks(sessionSlug);
}
