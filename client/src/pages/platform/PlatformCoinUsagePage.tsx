import { Navigate, useSearchParams } from 'react-router-dom';

/** @deprecated `/platform/tenants` 로 통합됨 — 기존 북마크·링크 호환용 */
export function PlatformCoinUsagePage() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={`/platform/tenants${qs ? `?${qs}` : ''}`} replace />;
}
