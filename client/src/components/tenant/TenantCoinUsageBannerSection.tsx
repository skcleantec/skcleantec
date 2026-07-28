import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { useTenantSubscriptionData } from '../../hooks/useTenantSubscriptionData';
import { TENANT_SUBSCRIPTION_ADMIN_PATH } from '../../utils/tenantUsageDisplay';
import { TenantCoinUsageBanner } from './TenantCoinUsageBanner';

type Props = {
  className?: string;
};

/** 구독 API를 불러와 코인 사용량 compact 배너를 표시 (발주서 발급 등) */
export function TenantCoinUsageBannerSection({ className }: Props) {
  const { staffMe } = useAdminStaffSession();
  const { data, loading } = useTenantSubscriptionData();

  if (loading || !data) return null;

  const showDetailLink = canAccessAdminPath(
    staffMe?.role,
    staffMe?.marketerPermissions,
    TENANT_SUBSCRIPTION_ADMIN_PATH,
  );

  return (
    <TenantCoinUsageBanner data={data} showDetailLink={showDetailLink} className={className} />
  );
}
