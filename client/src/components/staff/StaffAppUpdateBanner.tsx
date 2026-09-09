import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  completeStaffFlexibleAppUpdate,
  formatStaffAppVersionLabel,
  openStaffAppPlayStore,
  startStaffAppUpdate,
} from '../../utils/staffAppUpdate';
import { useSuppressTeamMobileBottomNav } from '../../hooks/useSuppressTeamMobileBottomNav';
import { useStaffAppUpdateContext } from './StaffAppUpdateProvider';

/** FAB(120)·길안내(130)보다 위. 하단 pill은 히트테스트가 z-index를 무시하는 WebView가 있어 반드시 숨김 */
const UPDATE_MODAL_Z = 'z-[200]';

const BTN =
  'relative z-[1] min-h-11 w-full touch-manipulation rounded-lg px-4 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const BTN_GHOST = `${BTN} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const BTN_PRIMARY = `${BTN} bg-slate-900 text-white hover:bg-slate-800`;

function useTapAction(action: () => void) {
  const lock = useRef(false);
  const run = () => {
    if (lock.current) return;
    lock.current = true;
    action();
    window.setTimeout(() => {
      lock.current = false;
    }, 500);
  };
  return {
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      run();
    },
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      run();
    },
  };
}

function UpdateModalFrame({
  ariaLabel,
  onBackdrop,
  children,
}: {
  ariaLabel: string;
  onBackdrop?: () => void;
  children: ReactNode;
}) {
  return createPortal(
    <div
      className={`fixed inset-0 ${UPDATE_MODAL_Z} flex items-end justify-center bg-black/50 p-3 pb-[max(4.5rem,calc(env(safe-area-inset-bottom,0px)+3.25rem))] sm:items-center sm:p-4 sm:pb-4`}
      role="presentation"
    >
      {onBackdrop ? (
        <button
          type="button"
          aria-label="닫기"
          className="absolute inset-0 cursor-default"
          onClick={onBackdrop}
        />
      ) : (
        <div className="absolute inset-0" aria-hidden />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative z-[201] pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function StaffAppUpdateBanner() {
  const state = useStaffAppUpdateContext();
  const kind = state?.kind ?? 'none';
  const open = Boolean(
    state?.enabled &&
      state.manifest &&
      kind !== 'none' &&
      !(kind === 'optional' && state.optionalDismissed),
  );
  useSuppressTeamMobileBottomNav(open);

  const laterTap = useTapAction(() => state?.dismissOptional());
  const playTap = useTapAction(() => {
    if (state?.manifest) openStaffAppPlayStore(state.manifest.playStoreUrl);
  });
  const updateTap = useTapAction(() => startStaffAppUpdate(kind === 'required' ? 'immediate' : 'flexible'));
  const restartTap = useTapAction(() => completeStaffFlexibleAppUpdate());

  if (!open || !state?.manifest) return null;

  const { manifest, clientVersionCode, playStatus } = state;
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
    return (
      <UpdateModalFrame ariaLabel="앱 업데이트 필요">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">앱 업데이트가 필요합니다</h2>
          <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
            보안·안정을 위해 최신 앱으로 업데이트해 주세요.
          </p>
        </div>
        <div className="p-4 text-fluid-xs text-slate-700">
          {versionLine}
          {notes}
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3">
          <button type="button" className={BTN_GHOST} {...playTap}>
            Play Store에서 열기
          </button>
          <button type="button" className={BTN_PRIMARY} {...updateTap}>
            업데이트
          </button>
        </div>
      </UpdateModalFrame>
    );
  }

  if (kind === 'downloaded') {
    return (
      <UpdateModalFrame ariaLabel="업데이트 설치">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-fluid-sm font-semibold text-slate-900">새 버전 다운로드 완료</h2>
          <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
            앱을 다시 시작하면 업데이트가 적용됩니다.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 p-3">
          <button type="button" className={BTN_PRIMARY} {...restartTap}>
            앱 재시작
          </button>
        </div>
      </UpdateModalFrame>
    );
  }

  return (
    <UpdateModalFrame ariaLabel="앱 업데이트" onBackdrop={() => state.dismissOptional()}>
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-fluid-sm font-semibold text-slate-900">새 버전이 있습니다</h2>
        <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
          최신 앱으로 업데이트하면 길안내·안정성이 반영됩니다.
        </p>
      </div>
      <div className="p-4 text-fluid-xs text-slate-700">
        {versionLine}
        {notes}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-3">
        <button type="button" className={BTN_GHOST} {...laterTap}>
          나중에
        </button>
        <button type="button" className={BTN_GHOST} {...playTap}>
          Play Store에서 열기
        </button>
        <button type="button" className={BTN_PRIMARY} {...updateTap}>
          업데이트
        </button>
      </div>
    </UpdateModalFrame>
  );
}
