import type { SoomgoBridgeManifest, SoomgoBridgeStatus } from '@shared/soomgoBridge';
import {
  isSoomgoBridgeOutdated,
  isSoomgoBridgeUpdateNoticeVisible,
} from '../../../api/soomgoBridge';
import { CrmIconSoomgo } from '../crmUi';

export function CrmSoomgoUpdateStrip({
  status,
  bridgeManifest,
  onRequestUpdate,
  onRefresh,
  onOpenSoomgoBar,
  updateBusy = false,
}: {
  status: SoomgoBridgeStatus | null;
  bridgeManifest: SoomgoBridgeManifest | null;
  onRequestUpdate: () => void;
  onRefresh: () => void;
  onOpenSoomgoBar?: () => void;
  updateBusy?: boolean;
}) {
  if (!isSoomgoBridgeUpdateNoticeVisible(status, bridgeManifest)) return null;

  const outdated = isSoomgoBridgeOutdated(status, bridgeManifest);
  const latestLabel = bridgeManifest?.latestVersion?.trim() || status?.latestVersion?.trim();
  const currentLabel = status?.appVersion?.trim();
  const updatePhase = status?.updatePhase;
  const updateReady = updatePhase === 'ready';
  const downloadUrl = bridgeManifest?.downloadUrl?.trim() || '';

  const versionText =
    currentLabel && latestLabel
      ? updateReady
        ? `v${latestLabel} 설치 준비 완료 (현재 v${currentLabel})`
        : updatePhase === 'downloading'
          ? `v${latestLabel} 다운로드 중… (현재 v${currentLabel})`
          : updatePhase === 'installing'
            ? `v${latestLabel} 설치 중… (현재 v${currentLabel})`
            : `v${currentLabel} → v${latestLabel} 업데이트가 필요합니다`
      : '숨고 연동 프로그램을 최신 버전으로 업데이트해 주세요';

  const tone = outdated ? 'rose' : 'amber';
  const badgeLabel = outdated
    ? '업데이트 필요'
    : updateReady
      ? '업데이트 준비됨'
      : updatePhase === 'downloading'
        ? '다운로드 중'
        : updatePhase === 'installing'
          ? '설치 중'
          : '새 버전';

  return (
    <div
      className={`shrink-0 border-b px-3 py-2 sm:px-4 ${
        tone === 'rose'
          ? 'border-rose-200/90 bg-gradient-to-r from-rose-50 via-rose-50/80 to-rose-50'
          : 'border-amber-200/90 bg-gradient-to-r from-amber-50 via-amber-50/80 to-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${
              tone === 'rose' ? 'bg-rose-600' : 'bg-amber-600'
            }`}
          >
            <CrmIconSoomgo className="h-4 w-4" />
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              tone === 'rose' ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {badgeLabel}
          </span>
          <span
            className={`min-w-0 text-fluid-xs font-medium ${
              tone === 'rose' ? 'text-rose-950' : 'text-amber-950'
            }`}
          >
            {versionText}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          {onOpenSoomgoBar ? (
            <button
              type="button"
              disabled={updateBusy}
              onClick={onOpenSoomgoBar}
              className={`rounded-lg border bg-white px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                tone === 'rose'
                  ? 'border-rose-300 text-rose-900 hover:bg-rose-50'
                  : 'border-amber-300 text-amber-900 hover:bg-amber-50'
              }`}
            >
              연동 상태
            </button>
          ) : null}
          <button
            type="button"
            disabled={updateBusy}
            onClick={onRequestUpdate}
            className={`rounded-lg border bg-white px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              tone === 'rose'
                ? 'border-rose-300 text-rose-900 hover:bg-rose-50'
                : 'border-amber-300 text-amber-900 hover:bg-amber-50'
            }`}
          >
            {updateBusy ? '요청 중…' : updateReady ? '지금 업데이트' : '업데이트'}
          </button>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-lg border bg-white px-2.5 py-1 text-[11px] font-semibold ${
                updateBusy ? 'pointer-events-none opacity-50' : ''
              } ${
                tone === 'rose'
                  ? 'border-rose-300 text-rose-900 hover:bg-rose-50'
                  : 'border-amber-300 text-amber-900 hover:bg-amber-50'
              }`}
            >
              설치
            </a>
          ) : null}
          <button
            type="button"
            disabled={updateBusy}
            onClick={onRefresh}
            className={`rounded-lg border bg-white px-2.5 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              tone === 'rose'
                ? 'border-rose-300 text-rose-900 hover:bg-rose-50'
                : 'border-amber-300 text-amber-900 hover:bg-amber-50'
            }`}
          >
            다시 확인
          </button>
        </div>
      </div>
    </div>
  );
}
