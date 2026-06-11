import { getToken } from '../../stores/auth';
import { AdminReviewPaybackPanel } from '../../components/review-payback/AdminReviewPaybackPanel';

export function AdminReviewPaybackPage() {
  const token = getToken();
  if (!token) return <p className="text-fluid-sm text-gray-500">로그인이 필요합니다.</p>;
  return <AdminReviewPaybackPanel token={token} />;
}
