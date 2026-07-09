import { Suspense, lazy } from 'react';
import { CrmDrawerShell } from '../layout/CrmDrawerShell';
import { TelecrmCatalogScopeSegment } from './telecrmSettingsUi';
import type { CrmCatalogScope, CrmSettingsTab } from '../../../hooks/useCrmPanelUrl';

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
const TelecrmSmsTemplateSettingsPage = lazy(() =>
  import('../../../pages/admin/crm/settings/TelecrmSmsTemplateSettingsPage').then((m) => ({
    default: m.TelecrmSmsTemplateSettingsPage,
  })),
);
const TelecrmSoomgoSettingsPage = lazy(() =>
  import('../../../pages/admin/crm/settings/TelecrmSoomgoSettingsPage').then((m) => ({
    default: m.TelecrmSoomgoSettingsPage,
  })),
);
const TelecrmSoomgoPresetsHub = lazy(() =>
  import('./TelecrmSoomgoPresetsHub').then((m) => ({
    default: m.TelecrmSoomgoPresetsHub,
  })),
);

const TABS: { id: CrmSettingsTab; label: string }[] = [
  { id: 'scripts', label: '스크립트' },
  { id: 'sms', label: '문자 템플릿' },
  { id: 'soomgo-presets', label: '숨고 프리셋' },
  { id: 'pricing', label: '가격' },
  { id: 'general', label: '기본 단가' },
  { id: 'soomgo', label: '숨고 연동' },
];

export function CrmSettingsDrawer({
  open,
  tab,
  catalogScope,
  canEditShared,
  canEditPersonal,
  onTabChange,
  onCatalogScopeChange,
  onClose,
}: {
  open: boolean;
  tab: CrmSettingsTab;
  catalogScope: CrmCatalogScope;
  canEditShared: boolean;
  canEditPersonal: boolean;
  onTabChange: (tab: CrmSettingsTab) => void;
  onCatalogScopeChange: (scope: CrmCatalogScope) => void;
  onClose: () => void;
}) {
  const visibleTabs = TABS.filter((item) => {
    if (item.id === 'general') return canEditShared;
    if (item.id === 'soomgo') return canEditShared;
    if (item.id === 'soomgo-presets') return canEditShared || canEditPersonal;
    return true;
  });
  const presetCatalogScope = canEditShared ? catalogScope : 'personal';
  const showCatalogSegment =
    tab !== 'general' &&
    tab !== 'soomgo' &&
    (canEditShared || canEditPersonal) &&
    (tab === 'soomgo-presets' ? canEditShared && canEditPersonal : true);
  const drawerWidth =
    tab === 'soomgo-presets' ? 'w-[min(760px,96vw)]' : 'w-[min(640px,94vw)]';
  const drawerSubtitle =
    tab === 'soomgo'
      ? '업체 공통 숨고 계정·PC 프로그램·브랜드별 계정을 설정합니다.'
      : tab === 'soomgo-presets'
        ? '숨고 채팅 매크로·부재/보류 자동 메시지를 편집합니다.'
        : '개인 스크립트·가격 또는 업체 공통 설정을 편집합니다.';

  return (
    <CrmDrawerShell
      open={open}
      title="텔레CRM 설정"
      subtitle={drawerSubtitle}
      onClose={onClose}
      widthClass={drawerWidth}
    >
      <nav className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        {visibleTabs.map((item) => (
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

      {showCatalogSegment ? (
        <div className="mb-4">
          <TelecrmCatalogScopeSegment
            value={catalogScope}
            onChange={onCatalogScopeChange}
            showPersonal={canEditPersonal}
            showShared={canEditShared}
          />
          <p className="mt-2 text-[11px] text-gray-500">
            {tab === 'soomgo-presets'
              ? catalogScope === 'personal'
                ? '본인 숨고 메시지 매크로입니다. 자동 안내는 「자동메시지」 탭(업체 공통)에서 설정합니다.'
                : '업체 공유 숨고 매크로입니다.'
              : catalogScope === 'personal'
                ? '본인만 보는 개인 카탈로그입니다. 작업 화면에서 내 항목이 먼저 표시됩니다.'
                : '업체 전체 마케터가 공유하는 기본 스크립트·가격입니다.'}
          </p>
        </div>
      ) : null}

      <Suspense fallback={<p className="text-fluid-sm text-gray-500">불러오는 중…</p>}>
        <div key={`${tab}-${catalogScope}`} className="min-w-0">
          {tab === 'scripts' ? <TelecrmScriptSettingsPage catalogScope={catalogScope} /> : null}
          {tab === 'sms' ? <TelecrmSmsTemplateSettingsPage catalogScope={catalogScope} /> : null}
          {tab === 'pricing' ? <TelecrmPricingSettingsPage catalogScope={catalogScope} /> : null}
          {tab === 'general' && canEditShared ? <TelecrmGeneralSettingsPage /> : null}
          {tab === 'soomgo-presets' && (canEditPersonal || canEditShared) ? (
            <TelecrmSoomgoPresetsHub
              catalogScope={presetCatalogScope}
              canEditAuto={canEditShared}
              syncViewToUrl={false}
            />
          ) : null}
          {tab === 'soomgo' && canEditShared ? (
            <TelecrmSoomgoSettingsPage presetsInDrawer />
          ) : null}
        </div>
      </Suspense>
    </CrmDrawerShell>
  );
}
