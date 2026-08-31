import { createPortal } from 'react-dom';
import {
  completeStaffFlexibleAppUpdate,
  formatStaffAppVersionLabel,
  openStaffAppPlayStore,
  startStaffAppUpdate,
} from '../../utils/staffAppUpdate';
import { useStaffAppUpdateContext } from './StaffAppUpdateProvider';

export function StaffAppUpdateBanner() {
  const state = useStaffAppUpdateContext();
  if (!state?.enabled || !state.manifest) return null;

  const { manifest, kind, optionalDismissed, clientVersionCode, playStatus } = state;

  if (kind === 'none') return null;

  if (kind === 'required') {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="앱 업데이트 필요"
          className="modal-mobile-fullscreen-panel flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:max-h-[90vh]"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-fluid-sm font-semibold text-slate-900">앱 업데이트가 필요합니다</h2>
            <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
              보안·안정을 위해 최신 앱으로 업데이트해 주세요.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-fluid-xs text-slate-700">
            <p>
              현재{' '}
              {formatStaffAppVersionLabel(playStatus?.clientVersionName, clientVersionCode)} → 최신{' '}
              {formatStaffAppVersionLabel(manifest.latestVersionName, manifest.latestVersionCode)}
            </p>
            {manifest.releaseNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-2 text-fluid-2xs text-slate-600">
                {manifest.releaseNotes}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => openStaffAppPlayStore()}
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Play Store에서 열기
            </button>
            <button
              type="button"
              onClick={() => startStaffAppUpdate('immediate')}
              className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              업데이트
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (kind === 'downloaded') {
    return (
      <div className="mb-2 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-emerald-900 sm:mb-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 flex-1">새 버전 다운로드가 완료되었습니다.</span>
          <button
            type="button"
            onClick={() => completeStaffFlexibleAppUpdate()}
            className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            앱 재시작
          </button>
        </div>
      </div>
    );
  }

  if (kind === 'optional' && optionalDismissed) return null;

  if (kind !== 'optional') return null;

  return (
    <div className="mb-2 shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-sky-950 sm:mb-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1">
          새 버전({formatStaffAppVersionLabel(manifest.latestVersionName, manifest.latestVersionCode)}
          )이 있습니다.
          {manifest.releaseNotes ? ` ${manifest.releaseNotes}` : ''}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => state.dismissOptional()}
            className="rounded-md px-2 py-1 text-fluid-2xs text-sky-800 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={() => startStaffAppUpdate('flexible')}
            className="rounded-md bg-slate-900 px-2.5 py-1 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            업데이트
          </button>
        </div>
      </div>
    </div>
  );
}
