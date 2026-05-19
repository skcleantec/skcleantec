import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { isLikelyNetworkFailure } from '../../api/fetchNetwork';
import { getAdminAdvertisingNavItems } from '../../constants/adminAdvertisingNav';
import { AdminCollapsibleSectionSideNav } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

const ADMIN_ADVERTISING_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-advertising-side-nav-collapsed';

function MobileAdvertisingSubNavTabs({ items }: { items: ReturnType<typeof getAdminAdvertisingNavItems> }) {
  return (
    <>
      {items.map((item) =>
        item.type === 'link' ? (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.title}
            className={({ isActive }) => adminSubNavTabClassName(isActive)}
          >
            {item.label}
          </NavLink>
        ) : null
      )}
    </>
  );
}

/** 광고비(/admin/advertising/*) — PC: 왼쪽 접이식 사이드 / 모바일: 가로 하위 탭 */
export function AdminAdvertisingLayout() {
  const token = getToken();
  const location = useLocation();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'marketer' | 'other' | 'network_error'>(
    'loading'
  );

  const probe = useCallback(() => {
    const t = getToken();
    if (!t) {
      setRoleGate('other');
      return;
    }
    setRoleGate('loading');
    void getMe(t)
      .then((u: { role?: string }) => {
        const r = u.role;
        if (r === 'ADMIN') setRoleGate('admin');
        else if (r === 'MARKETER') setRoleGate('marketer');
        else setRoleGate('other');
      })
      .catch((e: unknown) => {
        if (isAuthSessionExpiredError(e)) {
          setRoleGate('other');
          return;
        }
        if (
          isLikelyNetworkFailure(e) ||
          (e instanceof Error && e.message.includes('API 서버에 연결할 수 없습니다'))
        ) {
          setRoleGate('network_error');
          return;
        }
        setRoleGate('other');
      });
  }, []);

  useEffect(() => {
    probe();
  }, [token, probe]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (roleGate === 'loading') {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-gray-500 text-fluid-sm">
        권한 확인 중…
      </div>
    );
  }
  if (roleGate === 'network_error') {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        <p className="mb-4">일시적으로 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => probe()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (roleGate !== 'admin' && roleGate !== 'marketer') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const isAdmin = roleGate === 'admin';
  if (location.pathname.includes('/advertising/settings') && !isAdmin) {
    return <Navigate to="/admin/advertising" replace />;
  }

  const navItems = getAdminAdvertisingNavItems(isAdmin);

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="lg:hidden">
        <AdminSubNavScroll aria-label="광고비 하위 메뉴">
          <MobileAdvertisingSubNavTabs items={navItems} />
        </AdminSubNavScroll>
      </div>

      <div className="min-w-0 lg:flex lg:items-start lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:-ml-4">
          <AdminCollapsibleSectionSideNav
            title="광고비"
            items={navItems}
            aria-label="광고비 하위 메뉴"
            collapseStorageKey={ADMIN_ADVERTISING_SIDE_NAV_COLLAPSED_KEY}
          />
        </div>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
