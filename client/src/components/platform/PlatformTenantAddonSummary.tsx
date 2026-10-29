import { useEffect, useState } from 'react';
import { getPlatformTenantAlimtalkPolicy } from '../../api/platformTenants';
import type { PlatformTenantFeatureRow } from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { useTenantAddonSnapshot } from './PlatformTenantAddonStatus';
import { PlatformStatusBadge } from './PlatformStatusBadge';

function on(features: PlatformTenantFeatureRow[], moduleId: string) {
  return features.some((row) => row.moduleId === moduleId && row.effective);
}

export function PlatformTenantAddonSummary({
  tenantId,
  features,
}: {
  tenantId: string;
  features: PlatformTenantFeatureRow[];
}) {
  const snap = useTenantAddonSnapshot(tenantId);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    let cancelled = false;
    void getPlatformTenantAlimtalkPolicy(token, tenantId)
      .then((row) => {
        if (!cancelled) setBalance(row.prepaidBalanceKrw);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const cashbillOn = snap.members.some((row) => row.status === 'ACTIVE');
  const cashbillWait = snap.members.some((row) => row.status === 'PENDING_REVIEW');

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <span className="text-fluid-xs text-gray-500">지갑</span>
      <span className="text-fluid-sm font-bold tabular-nums text-gray-900">
        {balance === null ? '—' : `${balance.toLocaleString('ko-KR')}원`}
      </span>
      <PlatformStatusBadge tone={on(features, 'mod_alimtalk') ? 'ok' : 'muted'}>
        {on(features, 'mod_alimtalk') ? '알림톡 켜짐' : '알림톡 꺼짐'}
      </PlatformStatusBadge>
      <PlatformStatusBadge tone={on(features, 'mod_telecrm') ? 'ok' : 'muted'}>
        {on(features, 'mod_telecrm') ? '텔레CRM 켜짐' : '텔레CRM 꺼짐'}
      </PlatformStatusBadge>
      <PlatformStatusBadge tone={snap.loading ? 'muted' : snap.pgConnected ? 'ok' : 'warn'}>
        {snap.loading ? 'PG 확인 중' : snap.pgConnected ? 'PG 연결' : 'PG 없음'}
      </PlatformStatusBadge>
      <PlatformStatusBadge tone={snap.loading ? 'muted' : cashbillOn ? 'ok' : cashbillWait ? 'warn' : 'muted'}>
        {snap.loading ? '계산서 확인 중' : cashbillOn ? '계산서 연결' : cashbillWait ? '계산서 검토' : '계산서 없음'}
      </PlatformStatusBadge>
    </div>
  );
}
