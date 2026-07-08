import { useCallback, useEffect, useRef, useState } from 'react';
import type { SoomgoExtractedChat, SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { getToken } from '../stores/auth';
import { fetchTelecrmSoomgoCredentials } from '../api/telecrmSoomgo';
import {
  extractSoomgoCurrentChat,
  fetchSoomgoBridgeStatus,
  isSoomgoBridgeReachable,
  loginSoomgoBridge,
  openSoomgoChats,
  SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
  startSoomgoBridge,
} from '../api/soomgoBridge';
import { telecrmCall, telecrmDispatchNotice } from '../utils/telecrmNativeBridge';

export function useCrmSoomgoBridge({
  onImport,
  onDispatchNotice,
  pollEnabled = true,
}: {
  onImport: (data: SoomgoExtractedChat) => void;
  onDispatchNotice?: (message: string) => void;
  pollEnabled?: boolean;
}) {
  const [status, setStatus] = useState<SoomgoBridgeStatus | null>(null);
  const [preview, setPreview] = useState<SoomgoExtractedChat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const notify = useCallback((msg: string) => onDispatchNotice?.(msg), [onDispatchNotice]);

  const refreshStatus = useCallback(async () => {
    const s = await fetchSoomgoBridgeStatus();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    if (!pollEnabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    const poll = async () => {
      if (cancelled) return;
      const s = await refreshStatus();
      if (cancelled) return;
      timer = window.setTimeout(poll, s.bridgeRunning ? 4000 : 12000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pollEnabled, refreshStatus]);

  const openSoomgo = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const current = await refreshStatus();
      if (!isSoomgoBridgeReachable(current)) {
        throw new Error(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
      }
      await startSoomgoBridge();
      const token = getToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      const creds = await fetchTelecrmSoomgoCredentials(token);
      const loginRes = await loginSoomgoBridge(creds.email, creds.password);
      if (!loginRes.loggedIn) throw new Error(loginRes.lastError ?? '숨고 로그인에 실패했습니다.');
      await openSoomgoChats();
      const finalStatus = await refreshStatus();
      if (finalStatus.inChatRoom) {
        notify('숨고 채팅방이 연결되어 있습니다. 왼쪽 도구로 작업하세요.');
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
  }, [notify, refreshStatus]);

  const extract = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await extractSoomgoCurrentChat();
      setPreview(data);
      onImport(data);
      notify('고객 정보를 접수란에 채웠습니다.');
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
      let data = previewRef.current;
      if (!data?.phone) {
        data = await extractSoomgoCurrentChat();
        setPreview(data);
        onImport(data);
      }
      const digits = (data?.phone ?? '').replace(/\D/g, '');
      if (digits.length < 8) {
        throw new Error('채팅에서 전화번호를 찾지 못했습니다. 먼저 「정보 갖고오기」를 시도해 주세요.');
      }
      const result = await telecrmCall(data!.phone!, { customerMatch: 'new' });
      const notice = telecrmDispatchNotice(result, 'call');
      if (notice) notify(notice);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '통화 연결에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  }, [notify, onImport]);

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
