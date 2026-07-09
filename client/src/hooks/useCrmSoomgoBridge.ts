import { useCallback, useEffect, useRef, useState } from 'react';
import type { SoomgoExtractedChat, SoomgoBridgeStatus, SoomgoBridgeManifest } from '@shared/soomgoBridge';
import { getToken } from '../stores/auth';
import { fetchTelecrmSoomgoCredentials } from '../api/telecrmSoomgo';
import type { SoomgoBusyAction } from '../api/soomgoBridge';
import {
  ackSoomgoPendingCall,
  arrangeSoomgoBridgeLayout,
  extractSoomgoCallNumber,
  extractSoomgoCurrentChat,
  fetchSoomgoBridgeStatus,
  isSoomgoBridgeOutdated,
  isSoomgoBridgeReachable,
  isSoomgoAppUpdateAvailable,
  loginSoomgoBridge,
  openSoomgoCallModal,
  openSoomgoChats,
  requestSoomgoBridgeRestart,
  requestSoomgoBridgeUpdate,
  SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
  SOOMGO_BRIDGE_OUTDATED_MESSAGE,
  SOOMGO_BUSY_LABELS,
  soomgoBridgeOutdatedMessage,
  soomgoBridgeSoftUpdateMessage,
  startSoomgoBridge,
  watchSoomgoCallButton,
} from '../api/soomgoBridge';
import { arrangeCrmPopupLeftHalf, readSoomgoSplitScreenBounds } from '../utils/crmSoomgoSplitLayout';
import { telecrmDispatchNotice, telecrmPrefillPhone } from '../utils/telecrmNativeBridge';

export function useCrmSoomgoBridge({
  onImport,
  onImportPhone,
  onDispatchNotice,
  onImportNotice,
  pollEnabled = true,
  isPopup = false,
  bridgeManifest = null,
  operatingCompanyId = null,
}: {
  onImport: (data: SoomgoExtractedChat) => void;
  onImportPhone?: (phone: string) => void;
  onDispatchNotice?: (message: string) => void;
  onImportNotice?: (data: SoomgoExtractedChat) => void;
  pollEnabled?: boolean;
  isPopup?: boolean;
  bridgeManifest?: SoomgoBridgeManifest | null;
  operatingCompanyId?: string | null;
}) {
  const [status, setStatus] = useState<SoomgoBridgeStatus | null>(null);
  const [preview, setPreview] = useState<SoomgoExtractedChat | null>(null);
  const [busyAction, setBusyAction] = useState<SoomgoBusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const busyActionRef = useRef(busyAction);
  busyActionRef.current = busyAction;
  const lastHandledCallAtRef = useRef<number | null>(null);
  const watchStartedRef = useRef(false);
  const watchBlockedRef = useRef(false);
  const outdatedNotifiedRef = useRef(false);
  const softUpdateNotifiedRef = useRef(false);

  const notify = useCallback((msg: string) => onDispatchNotice?.(msg), [onDispatchNotice]);

  const prevOperatingCompanyIdRef = useRef(operatingCompanyId);
  useEffect(() => {
    if (prevOperatingCompanyIdRef.current === operatingCompanyId) return;
    prevOperatingCompanyIdRef.current = operatingCompanyId;
    watchStartedRef.current = false;
    watchBlockedRef.current = false;
    setPreview(null);
    if (operatingCompanyId) {
      notify('작업 브랜드가 변경되었습니다. 숨고 연동 시 해당 브랜드 계정으로 다시 로그인합니다.');
    }
  }, [notify, operatingCompanyId]);

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
      setPreview((prev) =>
        prev
          ? { ...prev, phone, safePhone: phone }
          : {
              chatId: status?.chatId ?? null,
              nickname: nickname ?? status?.nickname ?? null,
              phone,
              safePhone: phone,
              address: null,
              pyeong: null,
              memo: null,
              lastMessage: null,
              customerMessages: [],
            },
      );
      onImportPhone?.(phone);
      const result = await telecrmPrefillPhone(phone, { customerMatch: 'new' });
      const notice = telecrmDispatchNotice(result, 'prefill');
      if (notice) notify(notice);
      notify('숨고 안심번호가 연락처에 입력되었습니다.');
    },
    [notify, onImportPhone, status?.chatId, status?.nickname],
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

  const refreshStatus = useCallback(async (options?: { lite?: boolean }) => {
    const s = await fetchSoomgoBridgeStatus(bridgeManifest, { lite: options?.lite });
    setStatus(s);
    const outdatedMsg = soomgoBridgeOutdatedMessage(s, bridgeManifest);
    if (!isSoomgoBridgeOutdated(s, bridgeManifest)) {
      watchBlockedRef.current = false;
      outdatedNotifiedRef.current = false;
      setError((prev) =>
        prev && (prev.includes('API 업데이트') || prev === SOOMGO_BRIDGE_OUTDATED_MESSAGE) ? null : prev,
      );
    }
    if (isSoomgoBridgeOutdated(s, bridgeManifest) && !outdatedNotifiedRef.current) {
      outdatedNotifiedRef.current = true;
      softUpdateNotifiedRef.current = true;
      watchBlockedRef.current = true;
      setError(outdatedMsg);
      notify(outdatedMsg);
      void requestSoomgoBridgeUpdate('install');
    } else if (
      isSoomgoAppUpdateAvailable(s, bridgeManifest) &&
      !softUpdateNotifiedRef.current &&
      !isSoomgoBridgeOutdated(s, bridgeManifest)
    ) {
      softUpdateNotifiedRef.current = true;
      const softMsg = soomgoBridgeSoftUpdateMessage(s, bridgeManifest);
      if (softMsg) notify(softMsg);
      void requestSoomgoBridgeUpdate('background');
    }
    if (s.pendingCallPhone && s.pendingCallAt != null && !isSoomgoBridgeOutdated(s, bridgeManifest)) {
      void handlePendingCall(s);
    }
    return s;
  }, [bridgeManifest, handlePendingCall, notify]);

  const ensureCallWatch = useCallback(
    async (s: SoomgoBridgeStatus) => {
      if (!s.inChatRoom || watchStartedRef.current || watchBlockedRef.current || isSoomgoBridgeOutdated(s, bridgeManifest)) {
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
    [bridgeManifest, notify],
  );

  useEffect(() => {
    if (!pollEnabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    const poll = async () => {
      if (cancelled) return;
      const busy = busyActionRef.current;
      if (busy === 'extract' || busy === 'call') {
        timer = window.setTimeout(poll, 6000);
        return;
      }
      const s = await refreshStatus({ lite: busy !== 'open' });
      if (cancelled) return;
      if (s.inChatRoom && s.bridgeRunning && !isSoomgoBridgeOutdated(s, bridgeManifest) && !watchBlockedRef.current) {
        void ensureCallWatch(s);
      } else if (!s.inChatRoom) {
        watchStartedRef.current = false;
      }
      const interval = busy === 'open' ? 5000 : s.bridgeRunning ? 5000 : 12000;
      timer = window.setTimeout(poll, interval);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [bridgeManifest, pollEnabled, refreshStatus, ensureCallWatch]);

  const openSoomgo = useCallback(async () => {
    setBusyAction('open');
    setError(null);
    try {
      const current = await refreshStatus();
      if (!isSoomgoBridgeReachable(current)) {
        throw new Error(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
      }
      if (isSoomgoBridgeOutdated(current, bridgeManifest)) {
        const outdatedMsg = soomgoBridgeOutdatedMessage(current, bridgeManifest);
        void requestSoomgoBridgeUpdate('install');
        throw new Error(outdatedMsg);
      }
      const screen = readSoomgoSplitScreenBounds();
      if (isPopup) arrangeCrmPopupLeftHalf();
      const token = getToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      const [, creds] = await Promise.all([
        startSoomgoBridge(screen),
        fetchTelecrmSoomgoCredentials(token, operatingCompanyId),
      ]);
      const loginRes = await loginSoomgoBridge(creds.email, creds.password);
      if (!loginRes.loggedIn) throw new Error(loginRes.lastError ?? '숨고 로그인에 실패했습니다.');
      await openSoomgoChats(screen);
      await applySplitLayout();
      const finalStatus = await refreshStatus();
      if (finalStatus.inChatRoom) {
        await ensureCallWatch(finalStatus);
        notify('숨고 채팅방이 연결되었습니다. 「정보 갖고오기」로 고객 정보·안심번호를 한 번에 가져올 수 있습니다.');
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
      setBusyAction(null);
    }
  }, [applySplitLayout, bridgeManifest, ensureCallWatch, isPopup, notify, operatingCompanyId, refreshStatus]);

  const extract = useCallback(async () => {
    setBusyAction('extract');
    setError(null);
    try {
      notify('숨고에서 고객 정보를 가져오는 중입니다. Chrome 창을 건드리지 마세요.');
      const data = await extractSoomgoCurrentChat();
      setPreview(data);
      onImport(data);
      if (data.phone?.trim()) {
        const result = await telecrmPrefillPhone(data.phone.trim(), { customerMatch: 'new' });
        const prefillNotice = telecrmDispatchNotice(result, 'prefill');
        if (prefillNotice) notify(prefillNotice);
      }
      onImportNotice?.(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '정보를 가져오지 못했습니다.';
      setError(msg);
      notify(msg);
      return null;
    } finally {
      setBusyAction(null);
    }
  }, [notify, onImport, onImportNotice]);

  const callFromChat = useCallback(async () => {
    setBusyAction('call');
    setError(null);
    try {
      notify('숨고 안심번호를 가져오는 중입니다. Chrome 창을 건드리지 마세요.');
      await openSoomgoCallModal();
      await new Promise((r) => window.setTimeout(r, 280));
      let phone: string | null = null;
      for (let i = 0; i < 3; i += 1) {
        try {
          phone = await extractSoomgoCallNumber();
          break;
        } catch {
          if (i < 2) await new Promise((r) => window.setTimeout(r, 250));
        }
      }
      if (!phone) throw new Error('안심번호가 없습니다. 채팅만 희망 고객일 수 있습니다.');
      await applyCallPhone(phone);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '안심번호를 가져오지 못했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusyAction(null);
    }
  }, [applyCallPhone, notify]);

  const restartBridge = useCallback(async () => {
    setBusyAction('open');
    setError(null);
    try {
      await requestSoomgoBridgeRestart('bridge');
      notify('숨고 연동 프로그램 재시작을 요청했습니다.');
      await new Promise((r) => window.setTimeout(r, 1200));
      await refreshStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '재시작 요청에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusyAction(null);
    }
  }, [notify, refreshStatus]);

  const bridgeUp = isSoomgoBridgeReachable(status);
  const busy = busyAction != null;
  const busyLabel = busyAction ? SOOMGO_BUSY_LABELS[busyAction] : null;

  return {
    status,
    preview,
    busy,
    busyAction,
    busyLabel,
    error,
    bridgeUp,
    refreshStatus,
    openSoomgo,
    extract,
    callFromChat,
    restartBridge,
  };
}
