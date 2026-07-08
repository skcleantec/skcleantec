import { useCallback, useEffect, useRef, useState } from 'react';
import type { SoomgoExtractedChat, SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { getToken } from '../stores/auth';
import { fetchTelecrmSoomgoCredentials } from '../api/telecrmSoomgo';
import {
  ackSoomgoPendingCall,
  arrangeSoomgoBridgeLayout,
  extractSoomgoCallNumber,
  extractSoomgoCurrentChat,
  fetchSoomgoBridgeStatus,
  isSoomgoBridgeOutdated,
  isSoomgoBridgeReachable,
  loginSoomgoBridge,
  openSoomgoCallModal,
  openSoomgoChats,
  SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
  SOOMGO_BRIDGE_OUTDATED_MESSAGE,
  startSoomgoBridge,
  watchSoomgoCallButton,
} from '../api/soomgoBridge';
import { arrangeCrmPopupLeftHalf, readSoomgoSplitScreenBounds } from '../utils/crmSoomgoSplitLayout';
import { telecrmDispatchNotice, telecrmPrefillPhone } from '../utils/telecrmNativeBridge';

export function useCrmSoomgoBridge({
  onImport,
  onDispatchNotice,
  pollEnabled = true,
  isPopup = false,
}: {
  onImport: (data: SoomgoExtractedChat) => void;
  onDispatchNotice?: (message: string) => void;
  pollEnabled?: boolean;
  isPopup?: boolean;
}) {
  const [status, setStatus] = useState<SoomgoBridgeStatus | null>(null);
  const [preview, setPreview] = useState<SoomgoExtractedChat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const lastHandledCallAtRef = useRef<number | null>(null);
  const watchStartedRef = useRef(false);
  const watchBlockedRef = useRef(false);
  const outdatedNotifiedRef = useRef(false);

  const notify = useCallback((msg: string) => onDispatchNotice?.(msg), [onDispatchNotice]);

  const applySplitLayout = useCallback(async () => {
    if (isPopup) arrangeCrmPopupLeftHalf();
    const screen = readSoomgoSplitScreenBounds();
    try {
      await arrangeSoomgoBridgeLayout(screen);
    } catch {
      /* Chrome 미기동 시 무시 */
    }
  }, [isPopup]);

  const applyCallPhone = useCallback(
    async (phone: string, nickname?: string | null) => {
      const data: SoomgoExtractedChat = {
        chatId: status?.chatId ?? null,
        nickname: nickname ?? status?.nickname ?? null,
        phone,
        address: null,
        pyeong: null,
        memo: null,
        lastMessage: null,
        customerMessages: [],
      };
      setPreview(data);
      onImport(data);
      const result = await telecrmPrefillPhone(phone, { customerMatch: 'new' });
      const notice = telecrmDispatchNotice(result, 'prefill');
      if (notice) notify(notice);
      notify('숨고 안심번호가 연락처에 입력되었습니다.');
    },
    [notify, onImport, status?.chatId, status?.nickname],
  );

  const handlePendingCall = useCallback(
    async (s: SoomgoBridgeStatus) => {
      const phone = s.pendingCallPhone?.trim();
      const at = s.pendingCallAt;
      if (!phone || at == null) return;
      if (lastHandledCallAtRef.current === at) return;
      lastHandledCallAtRef.current = at;
      try {
        await applyCallPhone(phone, s.nickname);
        await ackSoomgoPendingCall(at);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '안심번호 연동에 실패했습니다.';
        notify(msg);
        lastHandledCallAtRef.current = null;
      }
    },
    [applyCallPhone, notify],
  );

  const refreshStatus = useCallback(async () => {
    const s = await fetchSoomgoBridgeStatus();
    setStatus(s);
    if (!isSoomgoBridgeOutdated(s)) {
      watchBlockedRef.current = false;
    }
    if (isSoomgoBridgeOutdated(s) && !outdatedNotifiedRef.current) {
      outdatedNotifiedRef.current = true;
      watchBlockedRef.current = true;
      setError(SOOMGO_BRIDGE_OUTDATED_MESSAGE);
      notify(SOOMGO_BRIDGE_OUTDATED_MESSAGE);
    }
    if (s.pendingCallPhone && s.pendingCallAt != null && !isSoomgoBridgeOutdated(s)) {
      void handlePendingCall(s);
    }
    return s;
  }, [handlePendingCall, notify]);

  const ensureCallWatch = useCallback(
    async (s: SoomgoBridgeStatus) => {
      if (!s.inChatRoom || watchStartedRef.current || watchBlockedRef.current || isSoomgoBridgeOutdated(s)) {
        return;
      }
      try {
        await watchSoomgoCallButton();
        watchStartedRef.current = true;
      } catch (e) {
        watchStartedRef.current = true;
        watchBlockedRef.current = true;
        const msg = e instanceof Error ? e.message : '';
        if (msg === SOOMGO_BRIDGE_OUTDATED_MESSAGE && !outdatedNotifiedRef.current) {
          outdatedNotifiedRef.current = true;
          setError(msg);
          notify(msg);
        }
      }
    },
    [notify],
  );

  useEffect(() => {
    if (!pollEnabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    const poll = async () => {
      if (cancelled) return;
      const s = await refreshStatus();
      if (cancelled) return;
      if (s.inChatRoom && s.bridgeRunning && !isSoomgoBridgeOutdated(s) && !watchBlockedRef.current) {
        void ensureCallWatch(s);
      } else if (!s.inChatRoom) {
        watchStartedRef.current = false;
      }
      timer = window.setTimeout(poll, s.bridgeRunning ? 3000 : 12000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pollEnabled, refreshStatus, ensureCallWatch]);

  const openSoomgo = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const current = await refreshStatus();
      if (!isSoomgoBridgeReachable(current)) {
        throw new Error(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
      }
      if (isSoomgoBridgeOutdated(current)) {
        throw new Error(SOOMGO_BRIDGE_OUTDATED_MESSAGE);
      }
      const screen = readSoomgoSplitScreenBounds();
      if (isPopup) arrangeCrmPopupLeftHalf();
      await startSoomgoBridge(screen);
      const token = getToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      const creds = await fetchTelecrmSoomgoCredentials(token);
      const loginRes = await loginSoomgoBridge(creds.email, creds.password);
      if (!loginRes.loggedIn) throw new Error(loginRes.lastError ?? '숨고 로그인에 실패했습니다.');
      await openSoomgoChats(screen);
      await applySplitLayout();
      const finalStatus = await refreshStatus();
      if (finalStatus.inChatRoom) {
        await ensureCallWatch(finalStatus);
        notify('숨고 채팅방이 연결되었습니다. 전화 아이콘 → 안심번호로 통화하기를 누르면 연락처에 들어갑니다.');
      } else if (finalStatus.onChatList) {
        notify('숨고 채팅 목록이 열렸습니다. 고객 채팅방을 연 뒤 왼쪽 도구를 사용하세요.');
      } else if (finalStatus.onRequestsPage) {
        notify('받은요청 화면에서 채팅으로 이동 중입니다. 채팅방을 연 뒤 다시 시도해 주세요.');
      } else {
        notify('숨고 Chrome 창이 열렸습니다. 채팅방을 연 뒤 왼쪽 도구를 사용하세요.');
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '숨고 연동에 실패했습니다.';
      setError(msg);
      notify(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }, [applySplitLayout, ensureCallWatch, isPopup, notify, refreshStatus]);

  const extract = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await extractSoomgoCurrentChat();
      setPreview(data);
      onImport(data);
      notify('고객 요청 정보를 접수란에 채웠습니다.');
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '정보를 가져오지 못했습니다.';
      setError(msg);
      notify(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, [notify, onImport]);

  const callFromChat = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await openSoomgoCallModal();
      const phone = await extractSoomgoCallNumber();
      await applyCallPhone(phone);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '안심번호를 가져오지 못했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  }, [applyCallPhone, notify]);

  const bridgeUp = isSoomgoBridgeReachable(status);

  return {
    status,
    preview,
    busy,
    error,
    bridgeUp,
    refreshStatus,
    openSoomgo,
    extract,
    callFromChat,
  };
}
