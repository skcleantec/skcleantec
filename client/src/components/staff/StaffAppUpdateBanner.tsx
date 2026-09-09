import { createPortal } from 'react-dom';
import {
  completeStaffFlexibleAppUpdate,
  formatStaffAppVersionLabel,
  openStaffAppPlayStore,
  startStaffAppUpdate,
} from '../../utils/staffAppUpdate';
import { useStaffAppUpdateContext } from './StaffAppUpdateProvider';

/** 팀장 FAB(z-120)보다 위 — 팀 화면에서 모달이 가려지지 않게 */
const UPDATE_MODAL_Z = 'z-[130]';

export function StaffAppUpdateBanner() {
  const state = useStaffAppUpdateContext();
  if (!state?.enabled || !state.manifest) return null;

  const { manifest, kind, optionalDismissed, clientVersionCode, playStatus } = state;

  if (kind === 'none') return null;

  const versionLine = (
    <p>
      현재 {formatStaffAppVersionLabel(playStatus?.clientVersionName, clientVersionCode)} → 최신{' '}
      {formatStaffAppVersionLabel(manifest.latestVersionName, manifest.latestVersionCode)}
    </p>
  );
  const notes = manifest.releaseNotes ? (
    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-2.5 py-2 text-fluid-2xs text-slate-600">
      {manifest.releaseNotes}
    </p>
  ) : null;

  if (kind === 'required') {
    return createPortal(
      <div
        className={`fixed inset-0 ${UPDATE_MODAL_Z} flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4`}
      >
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
            {versionLine}
            {notes}
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => openStaffAppPlayStore(manifest.playStoreUrl)}
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Play Store에서 열기
            </button>
            <button
              type="button"
              onClick={() => startStaffAppUpdate('immediate')}
              className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
    return createPortal(
      <div
        className={`fixed inset-0 ${UPDATE_MODAL_Z} flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="업데이트 설치"
          className="modal-mobile-fullscreen-panel flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-fluid-sm font-semibold text-slate-900">새 버전 다운로드 완료</h2>
            <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
              앱을 다시 시작하면 업데이트가 적용됩니다.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 p-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => completeStaffFlexibleAppUpdate()}
              className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              앱 재시작
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (kind === 'optional' && optionalDismissed) return null;

  if (kind !== 'optional') return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${UPDATE_MODAL_Z} flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="앱 업데이트"
        className="modal-mobile-fullscreen-panel flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:max-h-[90vh]"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">새 버전이 있습니다</h2>
          <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
            최신 앱으로 업데이트하면 길안내·안정성이 반영됩니다.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-fluid-xs text-slate-700">
          {versionLine}
          {notes}
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => state.dismissOptional()}
            className="min-h-10 rounded-lg border border-slate-300 px-4 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={() => openStaffAppPlayStore(manifest.playStoreUrl)}
            className="min-h-10 rounded-lg border border-slate-300 px-4 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Play Store에서 열기
          </button>
          <button
            type="button"
            onClick={() => startStaffAppUpdate('flexible')}
            className="min-h-10 rounded-lg bg-slate-900 px-4 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            업데이트
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
