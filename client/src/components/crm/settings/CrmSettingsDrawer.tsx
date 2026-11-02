import { Suspense, lazy } from 'react';
import { CrmDrawerShell } from '../layout/CrmDrawerShell';
import { TelecrmCatalogScopeSegment } from './telecrmSettingsUi';
import { CrmSettingsUsageGuide } from './CrmSettingsUsageGuide';
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
const AdminOrderFormLeadSourceSettingsPage = lazy(() =>
  import('../../../pages/admin/AdminOrderFormLeadSourceSettingsPage').then((m) => ({
    default: m.AdminOrderFormLeadSourceSettingsPage,
  })),
);
const TelecrmQuoteLearningSettingsPage = lazy(() =>
  import('../../../pages/admin/crm/settings/TelecrmQuoteLearningSettingsPage').then((m) => ({
    default: m.TelecrmQuoteLearningSettingsPage,
  })),
);

/** 왼쪽 메뉴 — 언제 쓰는 설정인지로 묶음 (설정 자체는 그대로, 위치·이름만 정리) */
const TAB_GROUPS: { title: string; items: { id: CrmSettingsTab; label: string }[] }[] = [
  {
    title: '통화할 때 보는 것',
    items: [
      { id: 'scripts', label: '상담 스크립트' },
      { id: 'pricing', label: '가격 항목' },
      { id: 'general', label: '기본 단가(평당가)' },
    ],
  },
  {
    title: '고객에게 보내는 것',
    items: [
      { id: 'sms', label: '문자 문구' },
      { id: 'soomgo-presets', label: '숨고 메시지 단추' },
      { id: 'soomgo-auto', label: '자동 메시지' },
    ],
  },
  {
    title: '연결·기타',
    items: [
      { id: 'soomgo', label: '숨고 연동' },
      { id: 'leadSource', label: '유입 경로' },
      { id: 'quote-learning', label: 'AI 견적 학습' },
    ],
  },
];

export function CrmSettingsDrawer({
  open,
  tab,
  catalogScope,
  canEditShared,
  canEditPersonal,
  canEditLeadSources,
  onTabChange,
  onCatalogScopeChange,
  onClose,
}: {
  open: boolean;
  tab: CrmSettingsTab;
  catalogScope: CrmCatalogScope;
  canEditShared: boolean;
  canEditPersonal: boolean;
  canEditLeadSources: boolean;
  onTabChange: (tab: CrmSettingsTab) => void;
  onCatalogScopeChange: (scope: CrmCatalogScope) => void;
  onClose: () => void;
}) {
  const isTabVisible = (id: CrmSettingsTab) => {
    if (id === 'quote-learning') return canEditShared || canEditPersonal;
    if (id === 'general') return canEditShared;
    if (id === 'leadSource') return canEditLeadSources;
    if (id === 'soomgo') return canEditShared;
    if (id === 'soomgo-presets' || id === 'soomgo-auto') return canEditShared || canEditPersonal;
    return true;
  };
  const visibleGroups = TAB_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isTabVisible(i.id)) })).filter(
    (g) => g.items.length > 0,
  );
  const presetCatalogScope = canEditShared ? catalogScope : 'personal';
  const showCatalogSegment =
    tab !== 'general' &&
    tab !== 'leadSource' &&
    tab !== 'soomgo' &&
    tab !== 'quote-learning' &&
    (canEditShared || canEditPersonal) &&
    (tab === 'soomgo-presets' || tab === 'soomgo-auto' ? canEditShared && canEditPersonal : true);
  const drawerWidth =
    tab === 'soomgo-presets' || tab === 'soomgo-auto' || tab === 'quote-learning'
      ? 'w-[min(940px,96vw)]'
      : 'w-[min(840px,96vw)]';
  const drawerSubtitle =
    tab === 'soomgo'
      ? '업체 공통 숨고 계정·PC 프로그램·브랜드별 계정을 설정합니다.'
      : tab === 'leadSource'
        ? '발주서 발급·텔레CRM·접수 저장 시 선택하는 유입 플랫폼 목록입니다.'
        : tab === 'quote-learning'
          ? '예약확정 접수에서 모은 견적·인원 데이터 학습 현황입니다. 텔레CRM 견적 패널 힌트에 반영됩니다.'
          : tab === 'soomgo-presets'
            ? '숨고 채팅 매크로·알림함 키워드(브랜드별, 업체 기본 폴백)를 편집합니다.'
            : tab === 'soomgo-auto'
              ? '통화 뒤·견적보내기·처리 구분 저장 때 숨고로 자동으로 나가는 메시지를 편집합니다.'
              : '개인 스크립트·가격 또는 업체 공통 설정을 편집합니다.';

  return (
    <CrmDrawerShell
      open={open}
      title="텔레CRM 설정"
      subtitle={drawerSubtitle}
      onClose={onClose}
      widthClass={drawerWidth}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
        <nav className="flex shrink-0 flex-wrap gap-x-3 gap-y-2 border-b border-slate-100 pb-3 sm:w-40 sm:flex-col sm:flex-nowrap sm:gap-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
          {visibleGroups.map((group) => (
            <div key={group.title} className="min-w-0">
              <p className="mb-1 px-2 text-fluid-2xs font-semibold text-slate-400">{group.title}</p>
              <div className="flex flex-wrap gap-0.5 sm:flex-col">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`inline-flex h-8 items-center whitespace-nowrap rounded-lg px-2.5 text-left text-fluid-sm font-medium ${
                      tab === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          <CrmSettingsUsageGuide guideKey={tab} />

          {showCatalogSegment ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <TelecrmCatalogScopeSegment
                value={catalogScope}
                onChange={onCatalogScopeChange}
                showPersonal={canEditPersonal}
                showShared={canEditShared}
              />
              <p className="text-fluid-2xs text-slate-500">
                {tab === 'soomgo-auto'
                  ? catalogScope === 'personal'
                    ? '내 통화가 끝난 뒤 숨고로 나가는 안내예요.'
                    : '견적보내기·처리 구분 저장 때 나가는 업체 공통 메시지예요.'
                  : tab === 'soomgo-presets'
                    ? catalogScope === 'personal'
                      ? '나만 쓰는 숨고 메시지 단추예요.'
                      : '우리 업체 상담사 모두가 쓰는 숨고 메시지 단추예요.'
                    : catalogScope === 'personal'
                      ? '나만 보는 항목이에요. 상담 화면에서 내 것이 먼저 보여요.'
                      : '우리 업체 상담사 모두에게 보여요.'}
              </p>
            </div>
          ) : null}

          <Suspense fallback={<p className="text-fluid-sm text-slate-500">불러오는 중…</p>}>
            <div key={`${tab}-${catalogScope}`} className="min-w-0">
              {tab === 'scripts' ? <TelecrmScriptSettingsPage catalogScope={catalogScope} /> : null}
              {tab === 'sms' ? <TelecrmSmsTemplateSettingsPage catalogScope={catalogScope} /> : null}
              {tab === 'pricing' ? <TelecrmPricingSettingsPage catalogScope={catalogScope} /> : null}
              {tab === 'general' && canEditShared ? <TelecrmGeneralSettingsPage /> : null}
              {tab === 'leadSource' && canEditLeadSources ? <AdminOrderFormLeadSourceSettingsPage /> : null}
              {tab === 'soomgo-presets' && (canEditPersonal || canEditShared) ? (
                <TelecrmSoomgoPresetsHub
                  catalogScope={presetCatalogScope}
                  canEditAuto={canEditShared}
                  syncViewToUrl={false}
                />
              ) : null}
              {tab === 'soomgo-auto' && (canEditPersonal || canEditShared) ? (
                <TelecrmSoomgoPresetsHub
                  catalogScope={presetCatalogScope}
                  canEditAuto={canEditShared}
                  syncViewToUrl={false}
                  initialView={presetCatalogScope === 'shared' && canEditShared ? 'auto' : 'call'}
                />
              ) : null}
              {tab === 'soomgo' && canEditShared ? (
                <TelecrmSoomgoSettingsPage presetsInDrawer />
              ) : null}
              {tab === 'quote-learning' && (canEditPersonal || canEditShared) ? (
                <TelecrmQuoteLearningSettingsPage />
              ) : null}
            </div>
          </Suspense>
        </div>
      </div>
    </CrmDrawerShell>
  );
}
