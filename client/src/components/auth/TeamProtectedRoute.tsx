import { Navigate, useLocation } from 'react-router-dom';
import { getTeamToken } from '../../stores/teamAuth';

export function TeamProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getTeamToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/team/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
