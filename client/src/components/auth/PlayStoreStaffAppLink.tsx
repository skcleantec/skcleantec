import {
  CBISEO_STAFF_APP_DISPLAY_NAME,
  CBISEO_STAFF_APP_PLAY_STORE_URL,
} from '@shared/cbiseoStaffAppPolicy';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';
import { isStandalonePwa } from '../../utils/pwaStandalone';

const PLAY_BADGE_SRC =
  'https://play.google.com/intl/ko/badges/static/images/badges/ko_badge_web_generic.png';

function isAndroidMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** Google Play 「청소비서」 설치 유도 — PWA 홈 추가 대신 사용 */
export function PlayStoreStaffAppLink({ compact = false }: { compact?: boolean }) {
  if (isCbiseoStaffNativeApp() || isStandalonePwa()) return null;
  if (!isAndroidMobile()) return null;

  const title = `Google Play에서 ${CBISEO_STAFF_APP_DISPLAY_NAME} 다운로드`;

  return (
    <a
      href={CBISEO_STAFF_APP_PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={
        compact
          ? 'inline-flex shrink-0 items-center transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2'
          : 'inline-flex items-center transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2'
      }
    >
      <img
        src={PLAY_BADGE_SRC}
        alt={title}
        className={compact ? 'h-8 w-auto block' : 'h-12 w-auto block'}
        decoding="async"
      />
    </a>
  );
}

/** 알림 설정 등 — 브라우저 사용자용 Play 설치 안내 */
export function PlayStoreStaffAppBanner() {
  if (isCbiseoStaffNativeApp() || isStandalonePwa()) return null;

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 space-y-2">
      <p className="text-fluid-2xs leading-snug text-sky-950">
        <strong>푸시 알림</strong>은 Google Play 「{CBISEO_STAFF_APP_DISPLAY_NAME}」 앱에서만 받을 수
        있습니다. 브라우저·홈 화면 추가(PWA)로는 배정·일정 알림이 오지 않습니다.
      </p>
      {isAndroidMobile() ? (
        <div className="flex flex-wrap items-center gap-2">
          <PlayStoreStaffAppLink />
          <span className="text-fluid-2xs text-sky-900">앱 설치 후 알림 허용을 켜 주세요.</span>
        </div>
      ) : (
        <p className="text-fluid-2xs text-sky-900">
          Android 기기에서 Google Play 앱을 설치해 주세요. iPhone·iPad는 브라우저로 이용할 수 있으며 푸시는
          지원하지 않습니다.
        </p>
      )}
    </div>
  );
}
