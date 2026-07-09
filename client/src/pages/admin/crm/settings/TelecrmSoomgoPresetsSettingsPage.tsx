import { useSearchParams } from 'react-router-dom';
import type { TelecrmCatalogOwnerScope } from '../../../../api/telecrm';
import { TelecrmSoomgoPresetsHub } from '../../../../components/crm/settings/TelecrmSoomgoPresetsHub';
import { useMarketerPermissions } from '../../../../hooks/useMarketerPermissions';

/** 텔레CRM 설정 허브 — 숨고 메시지 프리셋 (매크로 / 자동메시지) */
export function TelecrmSoomgoPresetsSettingsPage() {
  const [searchParams] = useSearchParams();
  const permissions = useMarketerPermissions();
  const catalogScope: TelecrmCatalogOwnerScope =
    searchParams.get('catalog') === 'shared' ? 'shared' : 'personal';
  const canEditAuto = permissions.has('crm.settings');

  return (
    <div className="min-w-0">
      <TelecrmSoomgoPresetsHub catalogScope={catalogScope} canEditAuto={canEditAuto} />
    </div>
  );
}
