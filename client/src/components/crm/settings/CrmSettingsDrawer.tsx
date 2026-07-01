import { Suspense, lazy } from 'react';
import { CrmDrawerShell } from '../layout/CrmDrawerShell';
import type { CrmSettingsTab } from '../../../hooks/useCrmPanelUrl';

const TelecrmScriptSettingsPage = lazy(() =>
  import('../../../pages/admin/crm/settings/TelecrmScriptSettingsPage').then((m) => ({
    default: m.TelecrmScriptSettingsPage,
  })),
);
const TelecrmPricingSettingsPage = lazy(() =>
  import('../../../pages/admin/crm/settings/TelecrmPricingSettingsPage').then((m) => ({
    default: m.TelecrmPricingSettingsPage,
  })),
);
const TelecrmGeneralSettingsPage = lazy(() =>
  import('../../../pages/admin/crm/settings/TelecrmGeneralSettingsPage').then((m) => ({
    default: m.TelecrmGeneralSettingsPage,
  })),
);

const TABS: { id: CrmSettingsTab; label: string }[] = [
  { id: 'scripts', label: '스크립트' },
  { id: 'pricing', label: '가격' },
  { id: 'general', label: '기본 단가' },
];

export function CrmSettingsDrawer({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: CrmSettingsTab;
  onTabChange: (tab: CrmSettingsTab) => void;
  onClose: () => void;
}) {
  return (
    <CrmDrawerShell
      open={open}
      title="텔레CRM 설정"
      subtitle="스크립트·가격·평당 단가를 이 창에서 편집합니다."
      onClose={onClose}
      widthClass="w-[min(640px,94vw)]"
    >
      <nav className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`rounded-lg px-4 py-2 text-fluid-sm font-medium ${
              tab === item.id ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <Suspense fallback={<p className="text-fluid-sm text-gray-500">불러오는 중…</p>}>
        <div key={tab} className="min-w-0">
          {tab === 'scripts' ? <TelecrmScriptSettingsPage /> : null}
          {tab === 'pricing' ? <TelecrmPricingSettingsPage /> : null}
          {tab === 'general' ? <TelecrmGeneralSettingsPage /> : null}
        </div>
      </Suspense>
    </CrmDrawerShell>
  );
}
