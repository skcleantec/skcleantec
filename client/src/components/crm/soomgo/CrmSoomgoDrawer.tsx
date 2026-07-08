import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { CrmSlideDrawer } from '../layout/CrmSlideDrawer';
import { CrmActionButton } from '../crmUi';
import { getToken } from '../../../stores/auth';
import {
  isSoomgoBridgeSequenceSupported,
  sendSoomgoBridgeMessage,
  sendSoomgoBridgeSequence,
  SOOMGO_BRIDGE_SEQUENCE_OUTDATED_MESSAGE,
} from '../../../api/soomgoBridge';
import {
  fetchTelecrmSoomgoMessagePresets,
  type SoomgoMessagePresetDto,
} from '../../../api/telecrmSoomgoMessagePresets';

export function CrmSoomgoDrawer({
  open,
  onClose,
  busy,
  bridgeStatus,
  onDispatchNotice,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  bridgeStatus?: SoomgoBridgeStatus | null;
  onDispatchNotice?: (message: string) => void;
}) {
  const token = getToken();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [presetBusySlot, setPresetBusySlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<SoomgoMessagePresetDto[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);

  const sequenceSupported = isSoomgoBridgeSequenceSupported(bridgeStatus);

  const activePresets = useMemo(
    () =>
      presets
        .filter((p) => p.isActive && p.steps.length > 0)
        .sort((a, b) => a.slotNumber - b.slotNumber),
    [presets],
  );

  const notify = (msg: string) => onDispatchNotice?.(msg);

  const loadPresets = useCallback(async () => {
    if (!token || !open) return;
    setPresetsLoading(true);
    try {
      const res = await fetchTelecrmSoomgoMessagePresets(token, { scope: 'work' });
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

  const handlePreset = async (preset: SoomgoMessagePresetDto) => {
    if (!sequenceSupported) {
      const msg = SOOMGO_BRIDGE_SEQUENCE_OUTDATED_MESSAGE;
      setError(msg);
      notify(msg);
      return;
    }
    setPresetBusySlot(preset.slotNumber);
    setError(null);
    try {
      await sendSoomgoBridgeSequence(preset.steps, bridgeStatus);
      notify(`프리셋 ${preset.slotNumber}번(${preset.label})을 전송했습니다.`);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '프리셋 전송에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setPresetBusySlot(null);
    }
  };

  return (
    <CrmSlideDrawer
      open={open}
      onClose={onClose}
      title="숨고 메시지"
      subtitle="Chrome 숨고 채팅방에 전송합니다."
      widthClass="w-[min(420px,94vw)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <p className="text-fluid-xs text-gray-500">
          숨고 Chrome 창에서 채팅방을 연 상태에서 보내 주세요.
        </p>

        {presetsLoading ? (
          <p className="text-fluid-xs text-gray-400">프리셋 불러오는 중…</p>
        ) : activePresets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-fluid-xs font-medium text-gray-700">저장된 프리셋</p>
            <div className="grid gap-2">
              {activePresets.map((preset) => (
                <CrmActionButton
                  key={preset.id}
                  accent="soomgo"
                  variant="soft"
                  disabled={busy || sending || presetBusySlot != null}
                  onClick={() => void handlePreset(preset)}
                >
                  {presetBusySlot === preset.slotNumber
                    ? `프리셋 ${preset.slotNumber} 전송 중…`
                    : `${preset.slotNumber}. ${preset.label}`}
                </CrmActionButton>
              ))}
            </div>
            {!sequenceSupported ? (
              <p className="text-fluid-xs text-amber-700">
                프리셋(이미지·순차 전송)은 숨고 연동 v2.1.0 이상이 필요합니다. 아래 직접 입력은 사용할 수 있습니다.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-fluid-xs font-medium text-gray-700">직접 입력</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="채팅방에 보낼 내용"
            className="min-h-[120px] w-full resize-y rounded-xl border border-sky-200 bg-white px-3 py-2 text-fluid-sm"
          />
        </div>

        {error ? <p className="text-fluid-xs text-rose-600">{error}</p> : null}
        <CrmActionButton
          accent="soomgo"
          variant="solid"
          disabled={busy || sending || presetBusySlot != null || !message.trim()}
          onClick={() => void handleSend()}
        >
          {sending ? '전송 중…' : '메시지 보내기'}
        </CrmActionButton>
      </div>
    </CrmSlideDrawer>
  );
}
