import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { TenantFeatureModuleId } from '@shared/tenantFeatureModules';
import { hasFeature } from '@shared/tenantFeatureModules';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';

type Props = {
  module: TenantFeatureModuleId;
  children: ReactNode;
};

/** 테넌트 기능 모듈 off 시 대시보드로 돌려보냄 */
export function FeatureGate({ module, children }: Props) {
  const { features } = useTenantCapabilities();
  const location = useLocation();

  if (features === null) {
    return (
      <div className="p-8 text-center text-fluid-sm text-gray-500">메뉴 권한 확인 중…</div>
    );
  }

  if (!hasFeature(features, module)) {
    return (
      <Navigate
        to="/admin/dashboard"
        replace
        state={{ featureDisabled: module, from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
