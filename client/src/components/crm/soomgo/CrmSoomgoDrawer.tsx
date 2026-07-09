import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import type { SoomgoMessagePresetDto, SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import { getToken } from '../../../stores/auth';
import {
  isSoomgoBridgeSequenceSupported,
  sendSoomgoBridgeMessage,
  sendSoomgoBridgeSequence,
  SOOMGO_BRIDGE_SEQUENCE_OUTDATED_MESSAGE,
} from '../../../api/soomgoBridge';
import { fetchTelecrmSoomgoMessagePresets } from '../../../api/telecrmSoomgoMessagePresets';
import {
  applyPresetSortOrder,
  persistPresetSortOrder,
  PresetDragReorderList,
  reorderPresetToSlot,
  SoomgoPresetDragHandle,
} from './soomgoPresetReorder';

function presetStepCount(steps: SoomgoMessageStep[]): { texts: number; images: number } {
  let texts = 0;
  let images = 0;
  for (const s of steps) {
    if (s.type === 'text') texts += 1;
    else images += s.urls.length;
  }
  return { texts, images };
}

function PresetPreview({ steps }: { steps: SoomgoMessageStep[] }) {
  if (steps.length === 0) {
    return <span className="text-[10px] text-slate-400">내용 없음</span>;
  }

  const firstText = steps.find((s) => s.type === 'text');
  const imageSteps = steps.filter((s) => s.type === 'images');
  const thumbUrls = imageSteps.flatMap((s) => s.urls).slice(0, 3);
  const totalImages = imageSteps.reduce((n, s) => n + s.urls.length, 0);
  const { texts, images } = presetStepCount(steps);

  return (
    <div className="min-w-0 space-y-1">
      {firstText ? (
        <p className="line-clamp-2 text-[10px] leading-snug text-slate-600" title={firstText.text}>
          {firstText.text}
        </p>
      ) : (
        <p className="text-[10px] text-slate-400">텍스트 없음</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {thumbUrls.length > 0 ? (
          <div className="flex items-center gap-0.5">
            {thumbUrls.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                className="h-6 w-6 shrink-0 rounded border border-slate-200 object-cover"
              />
            ))}
            {totalImages > thumbUrls.length ? (
              <span className="text-[9px] tabular-nums text-slate-400">+{totalImages - thumbUrls.length}</span>
            ) : null}
          </div>
        ) : null}
        <span className="text-[9px] tabular-nums text-slate-400">
          {texts > 0 ? `문구 ${texts}` : null}
          {texts > 0 && images > 0 ? ' · ' : null}
          {images > 0 ? `이미지 ${images}` : null}
          {steps.length > 1 ? ` · ${steps.length}단계` : null}
        </span>
      </div>
    </div>
  );
}

export function CrmSoomgoDrawer({
  open,
  onClose,
  busy,
  bridgeStatus,
  onDispatchNotice,
  onOpenPresetSettings,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  bridgeStatus?: SoomgoBridgeStatus | null;
  onDispatchNotice?: (message: string) => void;
  onOpenPresetSettings?: () => void;
}) {
  const token = getToken();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [presetBusyId, setPresetBusyId] = useState<string | null>(null);
  const [hoverPresetId, setHoverPresetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<SoomgoMessagePresetDto[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);

  const sequenceSupported = isSoomgoBridgeSequenceSupported(bridgeStatus);
  const sendDisabled = busy || sending || presetBusyId != null || reorderBusy;

  const activePresets = useMemo(
    () =>
      presets
        .filter((p) => p.isActive && p.steps.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'ko')),
    [presets],
  );

  const notify = (msg: string) => onDispatchNotice?.(msg);

  const loadPresets = useCallback(async () => {
    if (!token || !open) return;
    setPresetsLoading(true);
    try {
      const res = await fetchTelecrmSoomgoMessagePresets(token, { scope: 'personal' });
      setPresets(res.presets);
    } catch {
      setPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  }, [token, open]);

  useEffect(() => {
    if (open) void loadPresets();
  }, [open, loadPresets]);

  const handleSend = async () => {
    const body = message.trim();
    if (!body) {
      notify('보낼 메시지를 입력해 주세요.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendSoomgoBridgeMessage(body);
      setMessage('');
      notify('숨고 채팅방에 메시지를 보냈습니다.');
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '메시지 전송에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setSending(false);
    }
  };

  const handlePresetReorder = useCallback(
    async (dragId: string, slotIndex: number) => {
      if (!token) return;
      const next = reorderPresetToSlot(activePresets, dragId, slotIndex);
      const unchanged =
        next.length === activePresets.length && next.every((p, i) => p.id === activePresets[i]?.id);
      if (unchanged) return;

      setPresets((prev) => applyPresetSortOrder(prev, next));
      setReorderBusy(true);
      setError(null);
      try {
        await persistPresetSortOrder(token, next);
        notify('프리셋 순서를 저장했습니다.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : '순서 저장에 실패했습니다.';
        setError(msg);
        notify(msg);
        await loadPresets();
      } finally {
        setReorderBusy(false);
      }
    },
    [token, activePresets, notify, loadPresets],
  );

  const handlePreset = async (preset: SoomgoMessagePresetDto) => {
    if (!sequenceSupported) {
      const msg = SOOMGO_BRIDGE_SEQUENCE_OUTDATED_MESSAGE;
      setError(msg);
      notify(msg);
      return;
    }
    setPresetBusyId(preset.id);
    setError(null);
    try {
      await sendSoomgoBridgeSequence(preset.steps, bridgeStatus);
      notify(`「${preset.label}」 프리셋을 전송했습니다.`);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '프리셋 전송에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setPresetBusyId(null);
    }
  };

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="숨고 메시지"
      subtitle="Chrome 숨고 채팅방에 전송합니다."
      widthClass="w-[min(500px,94vw)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* 직접 입력 — 최상단 */}
        <section className="shrink-0 rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50/80 to-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-sky-950">직접 보내기</p>
            <span className="text-[10px] text-sky-700/80">채팅방 연결 후 전송</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="채팅방에 보낼 내용을 입력하세요"
            className="min-h-[88px] w-full resize-y rounded-xl border border-sky-200/80 bg-white px-3 py-2 text-fluid-sm text-slate-800 shadow-inner placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200/60"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && message.trim()) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">Ctrl+Enter로 전송</span>
            <button
              type="button"
              disabled={sendDisabled || !message.trim()}
              onClick={() => void handleSend()}
              className="rounded-lg bg-sky-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-40"
            >
              {sending ? '전송 중…' : '메시지 보내기'}
            </button>
          </div>
        </section>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
            {error}
          </p>
        ) : null}

        {/* 프리셋 */}
        <section className="min-h-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-800">내 프리셋</p>
              <p className="text-[10px] text-slate-500">
                버튼 클릭 시 전송 · ⋮⋮ 드래그 후 항목 사이에 놓기
              </p>
            </div>
            {onOpenPresetSettings ? (
              <button
                type="button"
                onClick={onOpenPresetSettings}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
              >
                편집
              </button>
            ) : null}
          </div>

          {presetsLoading ? (
            <p className="py-4 text-center text-[11px] text-slate-400">프리셋 불러오는 중…</p>
          ) : activePresets.length > 0 ? (
            <PresetDragReorderList
              className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain pr-0.5"
              items={activePresets}
              disabled={sendDisabled}
              onReorder={(dragId, slotIndex) => void handlePresetReorder(dragId, slotIndex)}
              renderItem={(preset, _index, { dragHandleProps }) => {
                const isBusy = presetBusyId === preset.id;
                const isHover = hoverPresetId === preset.id;
                return (
                  <div
                    className={[
                      'flex items-stretch gap-1.5 rounded-xl border p-1.5 transition-colors',
                      isHover || isBusy
                        ? 'border-sky-300 bg-sky-50/60 shadow-sm'
                        : 'border-slate-200/90 bg-slate-50/40 hover:border-slate-300 hover:bg-white',
                    ].join(' ')}
                    onMouseEnter={() => setHoverPresetId(preset.id)}
                    onMouseLeave={() => setHoverPresetId(null)}
                  >
                    <SoomgoPresetDragHandle
                      presetId={preset.id}
                      label={preset.label}
                      disabled={sendDisabled}
                      onDragStart={dragHandleProps.onDragStart}
                      onDragEnd={dragHandleProps.onDragEnd}
                    />
                    <button
                      type="button"
                      disabled={sendDisabled}
                      onClick={() => void handlePreset(preset)}
                      className={[
                        'flex w-[72px] shrink-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-center transition',
                        'border border-sky-200/90 bg-white text-[10px] font-semibold leading-tight text-sky-900',
                        'hover:border-sky-400 hover:bg-sky-50 disabled:opacity-40',
                        isBusy ? 'animate-pulse border-sky-400 bg-sky-100' : '',
                      ].join(' ')}
                      title={preset.label}
                    >
                      <span className="line-clamp-3 break-all">{isBusy ? '전송…' : preset.label}</span>
                    </button>
                    <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                      <PresetPreview steps={preset.steps} />
                    </div>
                  </div>
                );
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center">
              <p className="text-[11px] text-slate-600">저장된 프리셋이 없습니다.</p>
              {onOpenPresetSettings ? (
                <button
                  type="button"
                  onClick={onOpenPresetSettings}
                  className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-700"
                >
                  프리셋 추가
                </button>
              ) : (
                <p className="mt-1 text-[10px] text-slate-500">설정 → 숨고 프리셋에서 추가해 주세요.</p>
              )}
            </div>
          )}

          {!sequenceSupported && activePresets.length > 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-900">
              프리셋(이미지·순차 전송)은 숨고 연동 v2.1.0 이상이 필요합니다. 위 「직접 보내기」는 사용할 수 있습니다.
            </p>
          ) : null}
        </section>
      </div>
    </CrmSlideDrawer>
  );
}
