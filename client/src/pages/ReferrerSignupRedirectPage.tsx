import { Navigate, useParams } from 'react-router-dom';

/** `/r/:code` → `/signup?ref=:code` (짧은 추천 가입 링크) */
export function ReferrerSignupRedirectPage() {
  const { code = '' } = useParams();
  const normalized = code.trim().toLowerCase();
  if (!normalized) {
    return <Navigate to="/signup" replace />;
  }
  return <Navigate to={`/signup?ref=${encodeURIComponent(normalized)}`} replace />;
}
