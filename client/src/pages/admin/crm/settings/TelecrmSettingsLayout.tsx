import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { openTelecrmWindow } from '../../../../utils/openTelecrmWindow';
import { TelecrmCatalogScopeSegment } from '../../../../components/crm/settings/telecrmSettingsUi';
import { useMarketerPermissions } from '../../../../hooks/useMarketerPermissions';

const NAV = [
  { to: '/admin/crm/settings/scripts', label: '스크립트' },
  { to: '/admin/crm/settings/pricing', label: '가격' },
  { to: '/admin/crm/settings/general', label: '기본 단가' },
  { to: '/admin/crm/settings/soomgo', label: '숨고 연동' },
] as const;

export function TelecrmSettingsLayout() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useMarketerPermissions();
  const canShared = permissions.has('crm.settings');
  const canPersonal = permissions.has('crm.view');
  const isCatalogRoute =
    location.pathname.endsWith('/scripts') || location.pathname.endsWith('/pricing');
  const catalogScope = searchParams.get('catalog') === 'shared' ? 'shared' : 'personal';

  const setCatalogScope = (scope: 'shared' | 'personal') => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('catalog', scope);
        return next;
      },
      { replace: true },
    );
  };

  const visibleNav = NAV.filter((item) => {
    if (item.to === '/admin/crm/settings/general') return canShared;
    if (item.to === '/admin/crm/settings/soomgo') return canShared || canPersonal;
    return true;
  });

  return (
    <div className="min-w-0 w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">텔레CRM 설정</h1>
          <p className="mt-1 text-fluid-sm text-gray-500">
            개인 스크립트·가격과 업체 공통 설정을 등록하면 텔레CRM 작업 화면에 바로 반영됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openTelecrmWindow()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm text-gray-800 hover:bg-gray-50"
          >
            텔레CRM 열기
          </button>
          <Link
            to="/admin/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-fluid-sm text-gray-600 hover:bg-gray-50"
          >
            대시보드
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-fluid-sm font-medium ${
                isActive ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isCatalogRoute && (canShared || canPersonal) ? (
        <div>
          <TelecrmCatalogScopeSegment
            value={catalogScope}
            onChange={setCatalogScope}
            showPersonal={canPersonal}
            showShared={canShared}
          />
        </div>
      ) : null}

      <Outlet />
    </div>
  );
}
