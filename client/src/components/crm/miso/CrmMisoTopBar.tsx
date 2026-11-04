import type { MisoBridgeStatus, MisoChatListItem } from '@shared/misoBridge';
import { CrmIconMiso } from '../crmUi';

export function CrmMisoTopBar({
  open,
  onClose,
  status,
  bridgeUp,
  busy,
  busyLabel,
  error,
  onOpenMiso,
  onRefresh,
  onStartEmulator,
  onOpenInstall,
  onOpenMisoApp,
  downloadUrl,
  chatItems = [],
  onExtractChat,
  extractBusy = false,
}: {
  open: boolean;
  onClose: () => void;
  status: MisoBridgeStatus | null;
  bridgeUp: boolean;
  busy: boolean;
  busyLabel?: string | null;
  error: string | null;
  onOpenMiso: () => void;
  onRefresh: () => void;
  onStartEmulator?: () => void;
  onOpenInstall?: () => void;
  onOpenMisoApp?: () => void;
  downloadUrl?: string | null;
  chatItems?: MisoChatListItem[];
  onExtractChat?: (chatId: string) => void;
  extractBusy?: boolean;
}) {
  if (!open) return null;

  const listCount = chatItems.length;
  const stage = status?.setupStage;
  const automationActive = Boolean(status?.automationActive);
  const ready = bridgeUp && (stage === 'ready' || stage == null);
  const stageText = !bridgeUp
    ? 'PC에서 「청소비서 미소 연동」을 켠 뒤 「다시 확인」을 눌러 주세요.'
    : stage === 'no_emulator'
      ? '이 PC에서 가상폰을 찾지 못했습니다. 가상폰을 준비한 뒤 「다시 확인」을 눌러 주세요.'
      : stage === 'emulator_off'
        ? '가상폰이 꺼져 있습니다.'
        : stage === 'booting'
          ? '가상폰이 켜지는 중입니다. 끝나면 다음 안내가 나옵니다.'
          : stage === 'locale_pending'
            ? '가상폰을 한국어로 바꾸는 중'
            : stage === 'warming'
              ? '가상폰 준비 중'
              : stage === 'phone_busy'
                ? '가상폰이 아직 바빠요, 잠시 뒤 다시 확인'
                : stage === 'no_miso'
            ? '가상폰에 미소 앱이 없습니다.'
            : stage === 'miso_logged_out'
              ? '미소 앱에서 로그인한 뒤 「다시 확인」을 눌러 주세요.'
              : listCount > 0
                ? '채팅 목록이 연결되었습니다. 행을 누르면 정보를 가져옵니다.'
                : '가상폰과 미소가 준비되었습니다. 채팅 목록을 여세요.';
  const nextLabel =
    stage === 'emulator_off'
      ? '가상폰 켜기'
      : stage === 'no_miso'
        ? '미소 설치 화면 열기'
        : stage === 'miso_logged_out'
          ? '미소 앱 열기'
          : stage === 'no_emulator' ||
          stage === 'booting' ||
          stage === 'locale_pending' ||
          stage === 'warming' ||
          stage === 'phone_busy' ||
          !bridgeUp
            ? '다시 확인'
            : listCount > 0
              ? '목록 새로고침'
              : '채팅 목록 열기';
  const runNext = () => {
    if (
      !bridgeUp ||
      stage === 'no_emulator' ||
      stage === 'booting' ||
      stage === 'locale_pending' ||
      stage === 'warming' ||
      stage === 'phone_busy'
    ) {
      void onRefresh();
      return;
    }
    if (stage === 'emulator_off') {
      void onStartEmulator?.();
      return;
    }
    if (stage === 'no_miso') {
      void onOpenInstall?.();
      return;
    }
    if (stage === 'miso_logged_out') {
      void onOpenMisoApp?.();
      return;
    }
    void onOpenMiso();
  };

  return (
    <div className="shrink-0 border-b border-violet-200/90 bg-gradient-to-r from-violet-50 via-fuchsia-50/40 to-violet-50 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
            <CrmIconMiso className="h-4 w-4" />
          </span>
          <span className="text-fluid-xs font-bold text-violet-950">미소 연동</span>
        </div>

        <p className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-700" title={stageText}>
          {stageText}
        </p>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {!bridgeUp && downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-fluid-2xs font-semibold text-amber-950 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            >
              설치 파일 받기
            </a>
          ) : null}
          {!bridgeUp ? (
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-fluid-2xs font-semibold text-amber-950 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              다시 확인
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={runNext}
              className="rounded-lg bg-violet-600 px-3 py-1 text-fluid-2xs font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? '연결 중…' : nextLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-fluid-2xs text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label="미소 연동 바 닫기"
          >
            닫기
          </button>
        </div>
      </div>

      {automationActive ? (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-fluid-2xs font-medium text-amber-900">
          연동 프로그램이 동작 중입니다. 에뮬레이터 화면을 건드리지 말고 끝날 때까지 기다려 주세요.
        </p>
      ) : null}
      {busyLabel ? (
        <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-fluid-2xs font-medium text-amber-900">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" aria-hidden />
          {busyLabel} 에뮬레이터·미소 앱을 건드리지 마세요.
        </p>
      ) : null}
      {ready && listCount > 0 ? (
        <div className="border-t border-violet-100/80 bg-white/80 px-4 py-2">
          <p className="mb-1 text-fluid-2xs font-semibold text-violet-900">
            최근 채팅 — 행 클릭 시 정보 가져오기
          </p>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-fluid-2xs text-slate-700">
            {chatItems.slice(0, 8).map((item) => (
              <li key={item.chatId}>
                <button
                  type="button"
                  disabled={extractBusy || !onExtractChat}
                  onClick={() => onExtractChat?.(item.chatId)}
                  className="w-full truncate rounded-lg px-1 py-0.5 text-left hover:bg-violet-50 disabled:opacity-50"
                  title={item.preview ?? undefined}
                >
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  {item.statusLabel ? <span className="text-violet-700"> · {item.statusLabel}</span> : null}
                  {item.preview ? <span className="text-slate-500"> — {item.preview}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-1.5 text-fluid-2xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
