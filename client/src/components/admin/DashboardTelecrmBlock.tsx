import { getToken } from '../../stores/auth';
import { openTelecrmWindow } from '../../utils/openTelecrmWindow';
import { DashboardTopCard } from './dashboard/DashboardTopCard';
import { TELECRM_APP_INSTALL_PATH } from '../../api/telecrmAppManifest';

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

  if (!token) return null;

  return (
    <DashboardTopCard accent="violet">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-200/80">
          <TelecrmPhoneIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-violet-950">텔레CRM</h2>
          <p className="mt-1.5 flex-1 text-fluid-xs leading-snug text-slate-600">
            전화 상담·접수·스크립트·문자 발송을 한 화면에서 처리합니다.
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button
          type="button"
          onClick={() => openTelecrmWindow()}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-fluid-xs font-semibold text-white shadow-sm shadow-violet-200/60 hover:from-violet-700 hover:to-indigo-700"
        >
          텔레CRM 열기
        </button>
        <a
          href={TELECRM_APP_INSTALL_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-violet-300 bg-white/80 px-4 py-2 text-fluid-xs font-semibold text-violet-800 hover:bg-violet-50"
        >
          App 설치
        </a>
      </div>
    </DashboardTopCard>
  );
}
