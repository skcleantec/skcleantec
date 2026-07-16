import { Navigate, NavLink, useParams } from 'react-router-dom';
import {
  PLATFORM_SETTINGS_TABS,
  parsePlatformSettingsTab,
  platformSettingsTabPath,
  type PlatformSettingsTabId,
} from './settings/platformSettingsTabs';
import { PlatformSettingsSmtpTab } from './settings/PlatformSettingsSmtpTab';
import { PlatformSettingsLegalTab } from './settings/PlatformSettingsLegalTab';
import { CARD_SECTION } from '../../utils/platformUi';

function PlatformSettingsBusinessTab() {
  return (
    <section className={`${CARD_SECTION} text-sm text-gray-600`}>
      <h2 className="text-sm font-semibold text-gray-900">사업자 정보</h2>
      <p className="mt-2">
        사업자등록번호·상호·대표자·주소 등 플랫폼 운영사 정보를 관리하는 화면입니다. 추후 제공 예정입니다.
      </p>
    </section>
  );
}

function TabPanel({ tab }: { tab: PlatformSettingsTabId }) {
  if (tab === 'smtp') return <PlatformSettingsSmtpTab />;
  if (tab === 'business') return <PlatformSettingsBusinessTab />;
  if (tab === 'legal') return <PlatformSettingsLegalTab />;
  return null;
}

export function PlatformSettingsPage() {
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab = parsePlatformSettingsTab(tabParam);

  if (tabParam && tabParam !== tab) {
    return <Navigate to={platformSettingsTabPath(tab)} replace />;
  }

  return (
    <div className="space-y-6 pb-8 min-w-0 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">설정</h1>
        <p className="mt-1 text-sm text-gray-500">플랫폼 운영·알림·사업 정보</p>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 min-w-max" aria-label="설정 탭">
          {PLATFORM_SETTINGS_TABS.map((item) => {
            const to = platformSettingsTabPath(item.id);
            return (
              <NavLink
                key={item.id}
                to={to}
                end
                className={({ isActive }) =>
                  [
                    'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <p className="text-xs text-gray-500">
        {PLATFORM_SETTINGS_TABS.find((t) => t.id === tab)?.description}
      </p>

      <TabPanel tab={tab} />
    </div>
  );
}
