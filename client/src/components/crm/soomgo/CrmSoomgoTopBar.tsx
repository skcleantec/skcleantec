import type { SoomgoBridgeManifest, SoomgoBridgeStatus, SoomgoExtractedChat } from '@shared/soomgoBridge';
import { isSoomgoBridgeOutdated, isSoomgoAppUpdateAvailable, SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE } from '../../../api/soomgoBridge';
import { CrmIconSoomgo } from '../crmUi';

export function CrmSoomgoTopBar({
  open,
  onClose,
  status,
  preview,
  bridgeUp,
  busy,
  busyLabel,
  error,
  onOpenSoomgo,
  onRefresh,
  onRestartBridge,
  onOpenSettings,
  bridgeManifest,
  onRequestUpdate,
  updateBusy = false,
}: {
  open: boolean;
  onClose: () => void;
  status: SoomgoBridgeStatus | null;
  preview: SoomgoExtractedChat | null;
  bridgeUp: boolean;
  busy: boolean;
  busyLabel?: string | null;
  error: string | null;
  onOpenSoomgo: () => void;
  onRefresh: () => void;
  onRestartBridge?: () => void;
  onOpenSettings?: () => void;
  bridgeManifest?: SoomgoBridgeManifest | null;
  onRequestUpdate?: () => void;
  updateBusy?: boolean;
}) {
  if (!open) return null;

  const loggedIn = status?.loggedIn;
  const inRoom = status?.inChatRoom;
  const onChatList = status?.onChatList;
  const onRequestsPage = status?.onRequestsPage;

  const pageHint = inRoom
    ? '「정보 갖고오기」로 고객 요청·안심번호를 한 번에 가져옵니다 (채팅만 희망 시 번호 없이 채팅방 유지)'
    : onChatList
      ? '채팅 목록 · 고객 채팅방을 연 뒤 왼쪽 도구 사용'
      : onRequestsPage
        ? '받은요청 화면 감지 · 「채팅 열기」로 채팅 목록 이동'
        : loggedIn
          ? '채팅방을 연 뒤 왼쪽 도구 사용'
          : null;

  const outdated = isSoomgoBridgeOutdated(status, bridgeManifest);
  const softUpdate = !outdated && isSoomgoAppUpdateAvailable(status, bridgeManifest);
  const downloadUrl = bridgeManifest?.downloadUrl?.trim() || '';
  const latestLabel = bridgeManifest?.latestVersion?.trim() || status?.latestVersion?.trim();
  const currentLabel = status?.appVersion?.trim();
  const updatePhase = status?.updatePhase;
  const updateReady = updatePhase === 'ready';

  return (
    <div className="shrink-0 border-b border-sky-200/90 bg-gradient-to-r from-sky-50 via-cyan-50/40 to-sky-50 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
            <CrmIconSoomgo className="h-4 w-4" />
          </span>
          <span className="text-fluid-xs font-bold text-sky-950">숨고 연동</span>
        </div>

        {!bridgeUp ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[11px] text-amber-900">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold">브릿지 미실행</span>
            <span className="hidden min-w-0 truncate sm:inline" title={SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE}>
              「청소비서 숨고 연동」프로그램 실행 후 연결
            </span>
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-50"
              >
                설치
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-50"
            >
              다시 확인
            </button>
          </div>
        ) : outdated ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[11px] text-rose-900">
            <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold">업데이트 필요</span>
            <span className="hidden min-w-0 truncate sm:inline">
              {currentLabel && latestLabel
                ? `v${currentLabel} → v${latestLabel} 업데이트 후 다시 연결해 주세요`
                : '숨고 연동 프로그램을 최신 버전으로 업데이트하세요'}
            </span>
            {onRequestUpdate ? (
              <button
                type="button"
                disabled={updateBusy}
                onClick={onRequestUpdate}
                className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateBusy ? '요청 중…' : '업데이트'}
              </button>
            ) : null}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold hover:bg-rose-50"
              >
                설치
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-semibold hover:bg-rose-50"
            >
              다시 확인
            </button>
          </div>
        ) : softUpdate ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[11px] text-amber-900">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold">
              {updateReady ? '업데이트 준비됨' : updatePhase === 'downloading' ? '다운로드 중' : '새 버전'}
            </span>
            <span className="hidden min-w-0 truncate sm:inline">
              {currentLabel && latestLabel
                ? updateReady
                  ? `v${latestLabel} 설치 준비 완료 (현재 v${currentLabel})`
                  : updatePhase === 'downloading'
                    ? `v${latestLabel} 다운로드 중… (현재 v${currentLabel})`
                    : `v${latestLabel}이 나왔습니다 (현재 v${currentLabel})`
                : '숨고 연동 프로그램을 최신 버전으로 업데이트하세요'}
            </span>
            {onRequestUpdate ? (
              <button
                type="button"
                disabled={updateBusy}
                onClick={onRequestUpdate}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateBusy ? '요청 중…' : updateReady ? '지금 업데이트' : '업데이트'}
              </button>
            ) : null}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-50"
              >
                설치
              </a>
            ) : null}
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
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-sky-100">
                v{status.appVersion}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                loggedIn ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {loggedIn ? '숨고 로그인됨' : busy ? '로그인 중…' : '숨고 미로그인'}
            </span>
            {inRoom && status?.nickname ? (
              <span className="max-w-[120px] truncate rounded-full bg-white px-2 py-0.5 font-medium text-slate-700 ring-1 ring-sky-100">
                {status.nickname}
              </span>
            ) : null}
            {preview?.phone ? (
              <span className="tabular-nums rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-sky-100">
                {preview.phone}
              </span>
            ) : null}
            {preview?.pyeong ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-sky-100">
                {preview.pyeong}평
              </span>
            ) : null}
            {preview?.serviceType ? (
              <span className="max-w-[100px] truncate rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-sky-100">
                {preview.serviceType}
              </span>
            ) : null}
            {inRoom ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">채팅방</span>
            ) : onChatList ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-800">채팅 목록</span>
            ) : onRequestsPage ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">받은요청</span>
            ) : null}
          </div>
        )}

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {onRestartBridge && bridgeUp && !outdated && !softUpdate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRestartBridge()}
              className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-50 disabled:opacity-50"
            >
              재시작
            </button>
          ) : null}
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-50"
            >
              계정·연동
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !bridgeUp || outdated || softUpdate}
            onClick={() => void onOpenSoomgo()}
            className="rounded-lg bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? '연결 중…' : inRoom ? '채팅 유지' : '채팅 열기 / 로그인'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            aria-label="숨고 연동 바 닫기"
          >
            닫기
          </button>
        </div>
      </div>

      {busyLabel ? (
        <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-900">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" aria-hidden />
          {busyLabel} Chrome 숨고 창을 건드리지 마세요.
        </p>
      ) : null}
      {pageHint && !error && !busyLabel ? (
        <p className="border-t border-sky-100/80 bg-white/60 px-4 py-1.5 text-[11px] text-sky-800">{pageHint}</p>
      ) : null}
      {error ? (
        <p className="border-t border-rose-100 bg-rose-50 px-4 py-1.5 text-[11px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
