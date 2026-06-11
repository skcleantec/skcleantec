import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ADMIN_INQUIRIES_NAV_ITEMS } from '../../constants/adminInquiriesNav';
import { AdminCollapsibleSectionSideNav } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
import { getToken } from '../../stores/auth';
import { getReviewPaybackUnseenCount } from '../../api/reviewPayback';
import { useInboxRealtime, useReviewPaybackRealtime } from '../../hooks/useInboxRealtime';

const ADMIN_INQUIRIES_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-inquiries-side-nav-collapsed';
const REVIEW_PAYBACK_PATH = '/admin/inquiries/review-payback';

function MobileInquirySubNavTabs({ reviewPaybackBadge }: { reviewPaybackBadge: number }) {
  return (
    <>
      {ADMIN_INQUIRIES_NAV_ITEMS.flatMap((item) => {
        if (item.type === 'link') {
          const badge = item.to === REVIEW_PAYBACK_PATH ? reviewPaybackBadge : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.title}
              className={({ isActive }) => adminSubNavTabClassName(isActive)}
            >
              <span className="inline-flex items-center gap-1">
                {item.label}
                {badge > 0 ? (
                  <span className="rounded-full bg-red-600 px-1 py-0.5 text-[9px] font-semibold text-white tabular-nums">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
            </NavLink>
          );
        }
        return item.children.map((child) => (
          <NavLink
            key={child.to}
            to={child.to}
            end={child.end}
            title={child.title}
            className={({ isActive }) =>
              adminSubNavTabClassName(
                isActive,
                child.to === '/admin/inquiries/order-customer-preview' ? 'shrink-0' : undefined,
              )
            }
          >
            {child.label}
          </NavLink>
        ));
      })}
    </>
  );
}

/** 접수목록(/admin/inquiries/*) — PC: 왼쪽 계층 메뉴 / 모바일: 가로 하위 탭 */
export function AdminInquiriesLayout() {
  const token = getToken();
  const [reviewPaybackBadge, setReviewPaybackBadge] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshBadge = useCallback(async () => {
    if (!token) return;
    try {
      const count = await getReviewPaybackUnseenCount(token);
      setReviewPaybackBadge(count);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void refreshBadge();
  }, [refreshBadge]);

  useInboxRealtime(token, () => void refreshBadge(), Boolean(token));

  useReviewPaybackRealtime(
    token,
    (p) => {
      setToast(p.summary || `${p.customerName} 페이백/리뷰 신청`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
      void refreshBadge();
    },
    Boolean(token),
  );

  const navItems = useMemo(
    () =>
      ADMIN_INQUIRIES_NAV_ITEMS.map((item) => {
        if (item.type === 'link' && item.to === REVIEW_PAYBACK_PATH) {
          return { ...item, badge: reviewPaybackBadge };
        }
        return item;
      }),
    [reviewPaybackBadge],
  );

  return (
    <div className="min-w-0 w-full max-w-full">
      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-fluid-xs text-amber-950 shadow-lg"
        >
          {toast}
        </div>
      ) : null}

      <div className="lg:hidden">
        <AdminSubNavScroll aria-label="서비스접수 하위 메뉴">
          <MobileInquirySubNavTabs reviewPaybackBadge={reviewPaybackBadge} />
        </AdminSubNavScroll>
      </div>

      <div className="min-w-0 lg:flex lg:items-start lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:-ml-4">
          <AdminCollapsibleSectionSideNav
            title="서비스접수"
            items={navItems}
            aria-label="서비스접수 하위 메뉴"
            collapseStorageKey={ADMIN_INQUIRIES_SIDE_NAV_COLLAPSED_KEY}
          />
        </div>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
