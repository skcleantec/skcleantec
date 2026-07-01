import { Link } from 'react-router-dom';
import { getMe } from '../../api/auth';
import { getToken } from '../../stores/auth';
import { openTelecrmWindow } from '../../utils/openTelecrmWindow';
import { hasMarketerPermission } from '@shared/marketerPermissions';
import { useEffect, useState } from 'react';
import { DashboardTopCard } from './dashboard/DashboardTopCard';

function TelecrmPhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

export function DashboardTelecrmBlock() {
  const token = getToken();
  const [showSettingsLink, setShowSettingsLink] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMe(token)
      .then((u) => {
        if (cancelled) return;
        const role = typeof u.role === 'string' ? u.role : null;
        if (role === 'ADMIN') {
          setShowSettingsLink(true);
          return;
        }
        if (role === 'MARKETER' && u.marketerPermissions) {
          setShowSettingsLink(hasMarketerPermission(role, u.marketerPermissions, 'crm.settings'));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const handleOpen = () => {
    const opened = openTelecrmWindow();
    if (!opened) {
      window.alert('팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도해 주세요.');
    }
  };

  return (
    <DashboardTopCard>
      <h2 className="text-base font-semibold text-slate-900">텔레CRM</h2>
      <p className="mt-1.5 text-fluid-xs leading-snug text-slate-600">
        PC 새 창에서 전화 상담 · 접수 · 스크립트 · 견적을 처리합니다.
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]"
        >
          <TelecrmPhoneIcon className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">텔레CRM 열기</span>
        </button>
        {showSettingsLink ? (
          <Link
            to="/admin/crm/settings"
            className="text-fluid-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            CRM 설정
          </Link>
        ) : null}
      </div>
    </DashboardTopCard>
  );
}
