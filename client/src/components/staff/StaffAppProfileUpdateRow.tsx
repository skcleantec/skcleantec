import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';
import {
  formatStaffAppVersionLabel,
  getStaffAppVersionNameFromBridge,
} from '../../utils/staffAppUpdate';
import { useStaffAppUpdateContext } from './StaffAppUpdateProvider';

export function StaffAppProfileUpdateRow({ onMenuClose }: { onMenuClose: () => void }) {
  const state = useStaffAppUpdateContext();
  if (!isCbiseoStaffNativeApp() || !state) return null;

  const versionName = state.playStatus?.clientVersionName ?? getStaffAppVersionNameFromBridge();
  const versionCode = state.clientVersionCode;
  const label = formatStaffAppVersionLabel(versionName, versionCode);
  const hasUpdate = state.kind === 'optional' || state.kind === 'required' || state.kind === 'downloaded';

  return (
    <div className="border-t border-slate-100 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-fluid-2xs font-semibold text-slate-500">앱 정보</p>
          <p className="truncate text-sm text-slate-800">{label}</p>
        </div>
        {hasUpdate ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-fluid-2xs font-medium text-amber-900">
            새 버전
          </span>
        ) : null}
      </div>
      <button
        type="button"
        disabled={state.loading}
        onClick={() => {
          onMenuClose();
          void state.checkNow({ manual: true });
        }}
        className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        {state.loading ? '업데이트 확인 중…' : '업데이트 확인'}
      </button>
      {state.error ? (
        <p className="mt-1 text-fluid-2xs text-red-600" role="status">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
