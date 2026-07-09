import { useSearchParams } from 'react-router-dom';
import type { TelecrmCatalogOwnerScope } from '../../../../api/telecrm';
import { TelecrmSoomgoMessagePresetsSection } from '../../../../components/crm/settings/TelecrmSoomgoMessagePresetsSection';

/** 텔레CRM 설정 허브 — 숨고 메시지 프리셋 (개인/업체 공통) */
export function TelecrmSoomgoPresetsSettingsPage() {
  const [searchParams] = useSearchParams();
  const catalogScope: TelecrmCatalogOwnerScope =
    searchParams.get('catalog') === 'shared' ? 'shared' : 'personal';

  return (
    <div className="min-w-0">
      <TelecrmSoomgoMessagePresetsSection catalogScope={catalogScope} />
    </div>
  );
}
