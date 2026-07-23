import { useCallback, useEffect, useRef, useState } from 'react';
import type { MisoBridgeStatus, MisoChatListItem, MisoExtractPayload } from '@shared/misoBridge';
import {
  extractMisoCurrentChat,
  fetchMisoBridgeStatus,
  isMisoBridgeReachable,
  MISO_BRIDGE_NOT_RUNNING_MESSAGE,
  MISO_BUSY_LABELS,
  openMisoChats,
  sendMisoBridgeMessage,
  startMisoEmulator,
  type MisoBusyAction,
} from '../api/misoBridge';

export function useCrmMisoBridge({
  misoBarOpen = false,
  pollEnabled = true,
  onDispatchNotice,
  onImport,
}: {
  misoBarOpen?: boolean;
  pollEnabled?: boolean;
  onDispatchNotice?: (message: string) => void;
  onImport?: (data: MisoExtractPayload) => void;
}) {
  const [status, setStatus] = useState<MisoBridgeStatus | null>(null);
  const [chatItems, setChatItems] = useState<MisoChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<MisoBusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyActionRef = useRef(busyAction);
  busyActionRef.current = busyAction;
  const misoBarOpenRef = useRef(misoBarOpen);
  misoBarOpenRef.current = misoBarOpen;

  const notify = useCallback((msg: string) => onDispatchNotice?.(msg), [onDispatchNotice]);

  const refreshStatus = useCallback(async (options?: { lite?: boolean }) => {
    const s = await fetchMisoBridgeStatus(options);
    setStatus(s);
    if (!s.bridgeRunning) {
      setError(s.lastError ?? MISO_BRIDGE_NOT_RUNNING_MESSAGE);
    } else if (s.phase === 'skeleton') {
      setError(null);
    } else {
      setError(s.lastError ?? null);
    }
    return s;
  }, []);

  useEffect(() => {
    if (!pollEnabled) return;
    if (!misoBarOpen) return;
    let cancelled = false;
    void refreshStatus({ lite: true });
    const timer = window.setInterval(() => {
      if (cancelled || busyActionRef.current) return;
      void refreshStatus({ lite: true });
    }, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [misoBarOpen, pollEnabled, refreshStatus]);

  const openMiso = useCallback(async () => {
    setBusyAction('open');
    setError(null);
    try {
      const current = await refreshStatus();
      if (!isMisoBridgeReachable(current)) {
        throw new Error(MISO_BRIDGE_NOT_RUNNING_MESSAGE);
      }
      const res = await openMisoChats();
      if (!res.ok) {
        setError(res.error ?? '채팅 목록 연결에 실패했습니다.');
        notify(res.error ?? '채팅 목록 연결에 실패했습니다.');
        setChatItems([]);
      } else {
        setChatItems(res.items);
        const n = res.count ?? res.items.length;
        notify(`미소 채팅 목록 ${n}건을 불러왔습니다.`);
        setError(null);
      }
      await refreshStatus();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '미소 연동에 실패했습니다.';
      setError(msg);
      notify(msg);
      return false;
    } finally {
      setBusyAction(null);
    }
  }, [notify, refreshStatus]);

  const extract = useCallback(
    async (chatId?: string | null) => {
      setBusyAction('extract');
      setError(null);
      try {
        const current = await refreshStatus();
        if (!isMisoBridgeReachable(current)) {
          throw new Error(MISO_BRIDGE_NOT_RUNNING_MESSAGE);
        }
        const targetChatId =
          chatId?.trim() || activeChatId || chatItems[0]?.chatId || null;
        const data = await extractMisoCurrentChat(targetChatId);
        if (!data.ok) {
          const msg = data.error ?? '미소 정보 가져오기에 실패했습니다.';
          setError(msg);
          notify(msg);
          return null;
        }
        onImport?.(data);
        if (data.chatId) setActiveChatId(data.chatId);
        const phoneHint =
          data.phoneAvailable && data.phone
            ? ''
            : data.phoneNote?.trim() || '연락처는 고용·상담 상태에 따라 표시되지 않을 수 있습니다.';
        notify(
          data.phoneAvailable && data.phone
            ? '미소에서 고객 정보를 가져왔습니다.'
            : `미소에서 고객 정보를 가져왔습니다. (${phoneHint})`,
        );
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '미소 정보 가져오기에 실패했습니다.';
        setError(msg);
        notify(msg);
        return null;
      } finally {
        setBusyAction(null);
      }
    },
    [activeChatId, chatItems, notify, onImport, refreshStatus],
  );

  const sendMessage = useCallback(
    async (message: string, chatId?: string | null) => {
      setBusyAction('send');
      setError(null);
      try {
        const current = await refreshStatus();
        if (!isMisoBridgeReachable(current)) {
          throw new Error(MISO_BRIDGE_NOT_RUNNING_MESSAGE);
        }
        const targetChatId = chatId?.trim() || activeChatId;
        const res = await sendMisoBridgeMessage(message, targetChatId);
        if (!res.ok) {
          const msg = res.error ?? '미소 메시지 전송에 실패했습니다.';
          setError(msg);
          notify(msg);
          return false;
        }
        notify('미소 채팅에 메시지를 보냈습니다.');
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '미소 메시지 전송에 실패했습니다.';
        setError(msg);
        notify(msg);
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [activeChatId, notify, refreshStatus],
  );

  const startEmulator = useCallback(async () => {
    setError(null);
    try {
      const res = await startMisoEmulator();
      if (!res.ok) {
        throw new Error(res.error ?? '에뮬레이터 시작에 실패했습니다.');
      }
      notify(res.message ?? '에뮬레이터 시작을 요청했습니다.');
      window.setTimeout(() => void refreshStatus(), 3000);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '에뮬레이터 시작에 실패했습니다.';
      setError(msg);
      notify(msg);
      return false;
    }
  }, [notify, refreshStatus]);

  const busy = busyAction != null;
  const busyLabel = busyAction ? MISO_BUSY_LABELS[busyAction] : null;
  const bridgeUp = isMisoBridgeReachable(status);

  return {
    status,
    chatItems,
    activeChatId,
    bridgeUp,
    busy,
    busyAction,
    busyLabel,
    error,
    refreshStatus,
    openMiso,
    extract,
    sendMessage,
    startEmulator,
  };
}
