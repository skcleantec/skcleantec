import { Link } from 'react-router-dom';
import {
  isCbiseoStaffNativeApp,
  STAFF_APP_CRM_PC_MESSAGE,
} from '../../utils/cbiseoNativeApp';

/** 업무 앱(WebView)에서 PC 전용 화면 대신 안내 카드 */
export function StaffAppPcOnlyScreen({
  homeTo = '/admin/dashboard',
  homeLabel = '대시보드로',
}: {
  homeTo?: string;
  homeLabel?: string;
}) {
  if (!isCbiseoStaffNativeApp()) return null;
  return (
    <div className="login-surface flex min-h-[100dvh] flex-col items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-fluid-sm font-semibold text-slate-900">PC에서 이용해 주세요</h1>
        <p className="mt-3 text-fluid-xs leading-relaxed text-slate-600">{STAFF_APP_CRM_PC_MESSAGE}</p>
        <Link
          to={homeTo}
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
