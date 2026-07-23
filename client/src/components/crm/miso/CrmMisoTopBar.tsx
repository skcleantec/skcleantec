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
    ? 'run-bridge.bat 실행 후 「다시 확인」'
    : !emulatorReady
      ? 'Android 에뮬레이터를 켠 뒤 미소 파트너 앱을 실행하세요'
      : !misoInstalled
        ? '에뮬레이터에 미소 파트너(com.miso.cleaner) 앱을 설치·로그인하세요'
        : skeleton
          ? '브릿지 골격 단계 — 채팅·추출·전송은 순차 연결 예정'
        : listCount > 0
          ? '채팅 목록 연결됨 · 행 클릭=정보 가져오기 · 미소 메시지 도구로 전송'
          : misoForeground
            ? '미소 앱 포그라운드 · 왼쪽 도구로 정보 가져오기(예정)'
            : '미소 앱을 에뮬레이터에서 연 뒤 도구를 사용하세요';

  return (
    <div className="shrink-0 border-b border-violet-200/90 bg-gradient-to-r from-violet-50 via-fuchsia-50/40 to-violet-50 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
            <CrmIconMiso className="h-4 w-4" />
          </span>
          <span className="text-fluid-xs font-bold text-violet-950">미소 연동</span>
          {skeleton ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
              골격
            </span>
          ) : null}
        </div>

        {!bridgeUp ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[11px] text-amber-900">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold">브릿지 미실행</span>
            <span className="hidden min-w-0 truncate sm:inline" title={MISO_BRIDGE_NOT_RUNNING_MESSAGE}>
              청소비서 미소 연동(17891) 실행 후 연결
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
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">브릿지 연결</span>
            {status?.appVersion ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-violet-100">
                v{status.appVersion}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                emulatorReady ? 'bg-violet-100 text-violet-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {emulatorReady ? '에뮬 연결' : '에뮬 없음'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                misoInstalled ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-gray-100 text-gray-600'
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
            {status?.pageSize === 16384 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">16KB AVD</span>
            ) : null}
          </div>
        )}

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {onStartEmulator && bridgeUp && !emulatorReady ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStartEmulator()}
              className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
            >
              에뮬 시작
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !bridgeUp}
            onClick={() => void onOpenMiso()}
            className="rounded-lg bg-violet-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? '연결 중…' : listCount > 0 ? '목록 새로고침' : '채팅 목록 열기'}
          </button>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            aria-label="미소 연동 바 닫기"
          >
            닫기
          </button>
        </div>
      </div>

      {automationActive ? (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] font-medium text-amber-900">
          브릿지 자동화 실행 중 — 에뮬레이터 마우스/터치가 잠시 안 먹을 수 있습니다. 완료될 때까지 기다려 주세요.
        </p>
      ) : null}
      {busyLabel ? (
        <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-900">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" aria-hidden />
          {busyLabel} 에뮬레이터·미소 앱을 건드리지 마세요.
        </p>
      ) : null}
      {!error && !busyLabel && pageHint ? (
        <p className="border-t border-violet-100/80 bg-white/60 px-4 py-1.5 text-[11px] text-violet-800">{pageHint}</p>
      ) : null}
      {listCount > 0 ? (
        <div className="border-t border-violet-100/80 bg-white/80 px-4 py-2">
          <p className="mb-1 text-[10px] font-semibold text-violet-900">
            최근 채팅 — 행 클릭 시 정보 가져오기
          </p>
          <ul className="max-h-24 space-y-1 overflow-y-auto text-[10px] text-slate-700">
            {chatItems.slice(0, 8).map((item) => (
              <li key={item.chatId}>
                <button
                  type="button"
                  disabled={extractBusy || !onExtractChat}
                  onClick={() => onExtractChat?.(item.chatId)}
                  className="w-full truncate rounded px-1 py-0.5 text-left hover:bg-violet-50 disabled:opacity-50"
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
        <p className="border-t border-amber-100 bg-amber-50/80 px-4 py-1.5 text-[11px] text-amber-900">
          {status.notes.join(' · ')}
        </p>
      ) : null}
      {error ? (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-1.5 text-[11px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
