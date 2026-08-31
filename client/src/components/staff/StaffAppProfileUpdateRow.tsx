import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';
import {
  completeStaffFlexibleAppUpdate,
  formatStaffAppVersionLabel,
  getStaffAppVersionNameFromBridge,
  openStaffAppPlayStore,
  startStaffAppUpdate,
} from '../../utils/staffAppUpdate';
import { useStaffAppUpdateContext } from './StaffAppUpdateProvider';

export function StaffAppProfileUpdateRow({ onMenuClose }: { onMenuClose: () => void }) {
  const state = useStaffAppUpdateContext();
  if (!isCbiseoStaffNativeApp() || !state) return null;

  const versionName = state.playStatus?.clientVersionName ?? getStaffAppVersionNameFromBridge();
  const versionCode = state.clientVersionCode;
  const label = formatStaffAppVersionLabel(versionName, versionCode);
  const hasUpdate = state.kind === 'optional' || state.kind === 'required' || state.kind === 'downloaded';

  const handleUpdateAction = () => {
    onMenuClose();
    if (state.kind === 'downloaded') {
      completeStaffFlexibleAppUpdate();
      return;
    }
    if (state.kind === 'required') {
      startStaffAppUpdate('immediate');
      return;
    }
    if (state.kind === 'optional') {
      startStaffAppUpdate('flexible');
      return;
    }
    void state.checkNow({ manual: true });
  };

  const actionLabel =
    state.loading
      ? '업데이트 확인 중…'
      : state.kind === 'downloaded'
        ? '앱 재시작'
        : hasUpdate
          ? '업데이트'
          : '업데이트 확인';

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
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          disabled={state.loading}
          onClick={handleUpdateAction}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {actionLabel}
        </button>
        {hasUpdate ? (
          <button
            type="button"
            disabled={state.loading}
            onClick={() => {
              onMenuClose();
              openStaffAppPlayStore(state.manifest?.playStoreUrl);
            }}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-fluid-2xs text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            Play Store에서 열기
          </button>
        ) : null}
      </div>
      {state.error ? (
        <p className="mt-1 text-fluid-2xs text-red-600" role="status">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
