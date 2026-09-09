import { CBISEO_STAFF_APP_PLAY_STORE_URL } from '@shared/cbiseoStaffAppPolicy';
import { formatStaffAppVersionLabel } from '../../utils/staffAppUpdate';
import { useStaffAppUpdateContext } from './StaffAppUpdateProvider';

const CARD = 'mb-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:mb-3';
const BTN =
  'inline-flex min-h-11 w-full items-center justify-center touch-manipulation rounded-lg px-4 text-fluid-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';
const BTN_GHOST = `${BTN} border border-slate-300 bg-white text-slate-700`;
const BTN_PRIMARY = `${BTN} bg-slate-900 text-white`;

/**
 * 포털·전체화면 오버레이 금지 — 이 앱 WebView는 fixed 모달 버튼을 무시한다.
 * Play는 https &lt;a&gt; 만 쓴다(구 앱도 외부 링크로 연다).
 */
export function StaffAppUpdateBanner() {
  const state = useStaffAppUpdateContext();
  if (!state?.enabled || !state.manifest) return null;

  const { manifest, kind, optionalDismissed, clientVersionCode, playStatus } = state;
  if (kind === 'none') return null;
  if (kind === 'optional' && optionalDismissed) return null;

  const playHref = manifest.playStoreUrl?.trim() || CBISEO_STAFF_APP_PLAY_STORE_URL;
  const versionLine = (
    <p className="text-fluid-2xs text-slate-600">
      현재 {formatStaffAppVersionLabel(playStatus?.clientVersionName, clientVersionCode)} → 최신{' '}
      {formatStaffAppVersionLabel(manifest.latestVersionName, manifest.latestVersionCode)}
    </p>
  );
  const notes = manifest.releaseNotes ? (
    <p className="mt-1.5 whitespace-pre-wrap text-fluid-2xs text-slate-500">{manifest.releaseNotes}</p>
  ) : null;

  if (kind === 'downloaded') {
    return (
      <section className={CARD} aria-label="업데이트 설치">
        <h2 className="text-fluid-sm font-semibold text-slate-900">새 버전 다운로드 완료</h2>
        <p className="mt-1 text-fluid-2xs text-slate-600">앱을 다시 시작하면 업데이트가 적용됩니다.</p>
        <a href={playHref} className={`${BTN_PRIMARY} mt-3`}>
          Play Store에서 열기
        </a>
      </section>
    );
  }

  const title = kind === 'required' ? '앱 업데이트가 필요합니다' : '새 버전이 있습니다';
  const hint =
    kind === 'required'
      ? '보안·안정을 위해 최신 앱으로 업데이트해 주세요.'
      : '최신 앱으로 업데이트하면 길안내·안정성이 반영됩니다.';

  return (
    <section className={CARD} aria-label="앱 업데이트">
      <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">{hint}</p>
      <div className="mt-2">{versionLine}</div>
      {notes}
      <div className="mt-3 flex flex-col gap-2">
        {kind === 'optional' ? (
          <button type="button" className={BTN_GHOST} onClick={() => state.dismissOptional()}>
            나중에
          </button>
        ) : null}
        <a href={playHref} className={BTN_GHOST}>
          Play Store에서 열기
        </a>
        <a href={playHref} className={BTN_PRIMARY}>
          업데이트
        </a>
      </div>
    </section>
  );
}
