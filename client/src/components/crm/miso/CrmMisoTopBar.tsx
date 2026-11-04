import type { MisoBridgeStatus, MisoChatListItem } from '@shared/misoBridge';
import { MISO_BRIDGE_NOT_RUNNING_MESSAGE } from '../../../api/misoBridge';
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
  chatItems?: MisoChatListItem[];
  onExtractChat?: (chatId: string) => void;
  extractBusy?: boolean;
}) {
  if (!open) return null;

  const emulatorReady = Boolean(status?.emulatorReady);
  const misoInstalled = Boolean(status?.misoInstalled);
  const misoForeground = Boolean(status?.misoForeground);
  const skeleton = status?.phase === 'skeleton';
  const listCount = chatItems.length;

  const automationActive = Boolean(status?.automationActive);
  const pageHint = !bridgeUp
    ? 'PC에서 「청소비서 미소 연동」을 켠 뒤 「다시 확인」을 눌러 주세요.'
    : !emulatorReady
      ? '에뮬레이터를 켠 뒤 미소 파트너 앱을 실행하세요'
      : !misoInstalled
        ? '에뮬레이터에 미소 파트너 앱을 설치하고 로그인해 주세요'
        : skeleton
          ? '채팅 목록을 연 뒤 가져올 방을 고르세요'
        : listCount > 0
          ? '채팅 목록이 연결되었습니다. 행을 누르면 정보를 가져옵니다.'
          : misoForeground
            ? '미소 앱이 열려 있습니다. 채팅 목록에서 방을 고르세요.'
            : '에뮬레이터에서 미소 앱을 연 뒤 사용하세요';

  return (
    <div className="shrink-0 border-b border-violet-200/90 bg-gradient-to-r from-violet-50 via-fuchsia-50/40 to-violet-50 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
            <CrmIconMiso className="h-4 w-4" />
          </span>
          <span className="text-fluid-xs font-bold text-violet-950">미소 연동</span>
        </div>

        {!bridgeUp ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-fluid-2xs text-amber-900">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold">연동 프로그램 미실행</span>
            <span className="hidden min-w-0 truncate sm:inline" title={MISO_BRIDGE_NOT_RUNNING_MESSAGE}>
              PC에서 「청소비서 미소 연동」을 켠 뒤 「다시 확인」
            </span>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-50"
            >
              다시 확인
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-fluid-2xs">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">연동 프로그램 연결</span>
            {status?.appVersion ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-violet-100">
                v{status.appVersion}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                emulatorReady ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {emulatorReady ? '에뮬 연결' : '에뮬 없음'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                misoInstalled ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {misoInstalled
                ? status?.misoAppVersion
                  ? `미소 v${status.misoAppVersion}`
                  : '미소 설치됨'
                : '미소 미설치'}
            </span>
            {listCount > 0 ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800">
                목록 {listCount}건
              </span>
            ) : misoForeground ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800">앱 실행 중</span>
            ) : null}
          </div>
        )}

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {onStartEmulator && bridgeUp && !emulatorReady ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStartEmulator()}
              className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-fluid-2xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
            >
              에뮬 시작
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !bridgeUp}
            onClick={() => void onOpenMiso()}
            className="rounded-lg bg-violet-600 px-3 py-1 text-fluid-2xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? '연결 중…' : listCount > 0 ? '목록 새로고침' : '채팅 목록 열기'}
          </button>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-fluid-2xs text-slate-600 hover:bg-slate-50"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-fluid-2xs text-slate-600 hover:bg-slate-50"
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
      {!error && !busyLabel && pageHint ? (
        <p className="border-t border-violet-100/80 bg-white/60 px-4 py-1.5 text-fluid-2xs text-violet-800">{pageHint}</p>
      ) : null}
      {listCount > 0 ? (
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
      {status?.notes?.length ? (
        <p className="border-t border-amber-100 bg-amber-50/80 px-4 py-1.5 text-fluid-2xs text-amber-900">
          {status.notes.join(' · ')}
        </p>
      ) : null}
      {error ? (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-1.5 text-fluid-2xs text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
