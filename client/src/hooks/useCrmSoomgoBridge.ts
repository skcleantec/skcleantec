import { useCallback, useEffect, useRef, useState } from 'react';
import type { SoomgoExtractedChat, SoomgoBridgeStatus, SoomgoBridgeManifest, SoomgoChatAlert } from '@shared/soomgoBridge';
import { getToken } from '../stores/auth';
import { fetchTelecrmSoomgoCredentials } from '../api/telecrmSoomgo';
import type { SoomgoBusyAction } from '../api/soomgoBridge';
import {
  ackSoomgoPendingCall,
  ackSoomgoChatAlerts,
  arrangeSoomgoBridgeLayout,
  extractSoomgoCallNumber,
  extractSoomgoCurrentChat,
  fetchSoomgoBridgeStatus,
  isSoomgoBridgeChatAlertsSupported,
  isSoomgoBridgeOutdated,
  isSoomgoBridgeReachable,
  isSoomgoAppUpdateAvailable,
  isSoomgoBridgeUseBlocked,
  isSoomgoBridgeCrmManifestPassthroughSupported,
  installSoomgoBridgeFromCrmManifest,
  loginSoomgoBridge,
  openSoomgoCallModal,
  openSoomgoChatRoom,
  openSoomgoChats,
  requestSoomgoBridgeRestart,
  requestSoomgoBridgeUpdate,
  requestSoomgoBridgeUpdateFresh,
  SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
  SOOMGO_BRIDGE_OUTDATED_MESSAGE,
  SOOMGO_BUSY_LABELS,
  soomgoBridgeOutdatedMessage,
  soomgoBridgeSoftUpdateMessage,
  startSoomgoBridge,
  watchSoomgoCallButton,
  watchSoomgoChatList,
} from '../api/soomgoBridge';
import {
  arrangeCrmPopupLeftHalf,
  applyTelecrmSoomgoSplitLayout,
  readSoomgoSplitBoundsAfterCrmResize,
} from '../utils/crmSoomgoSplitLayout';
import { telecrmDispatchNotice, telecrmPrefillPhone } from '../utils/telecrmNativeBridge';

export function useCrmSoomgoBridge({
  onImport,
  onImportPhone,
  onDispatchNotice,
  onImportNotice,
  onChatAlerts,
  pollEnabled = true,
  isPopup = false,
  bridgeManifest = null,
  operatingCompanyId = null,
  refreshManifest,
  soomgoBarOpen = false,
}: {
  onImport: (data: SoomgoExtractedChat) => void;
  onImportPhone?: (phone: string) => void;
  onDispatchNotice?: (message: string) => void;
  onImportNotice?: (data: SoomgoExtractedChat) => void;
  onChatAlerts?: (alerts: SoomgoChatAlert[]) => void;
  pollEnabled?: boolean;
  isPopup?: boolean;
  bridgeManifest?: SoomgoBridgeManifest | null;
  operatingCompanyId?: string | null;
  refreshManifest?: () => Promise<SoomgoBridgeManifest | null>;
  /** 업데이트 완료 후 숨고 바가 열려 있으면 자동 재연결 */
  soomgoBarOpen?: boolean;
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
  const chatWatchStartedRef = useRef(false);
  const watchBlockedRef = useRef(false);
  const outdatedNotifiedRef = useRef(false);
  const softUpdateNotifiedRef = useRef(false);
  const useBlockedRef = useRef(false);
  const pendingSoomgoReconnectRef = useRef(false);
  const soomgoBarOpenRef = useRef(soomgoBarOpen);
  soomgoBarOpenRef.current = soomgoBarOpen;
  const openSoomgoRef = useRef<(() => Promise<boolean>) | null>(null);

  const notify = useCallback((msg: string) => onDispatchNotice?.(msg), [onDispatchNotice]);

  const prevOperatingCompanyIdRef = useRef(operatingCompanyId);
  useEffect(() => {
    if (prevOperatingCompanyIdRef.current === operatingCompanyId) return;
    prevOperatingCompanyIdRef.current = operatingCompanyId;
    watchStartedRef.current = false;
    chatWatchStartedRef.current = false;
    watchBlockedRef.current = false;
    setPreview(null);
    if (operatingCompanyId) {
      notify('작업 브랜드가 변경되었습니다. 숨고 연동 시 해당 브랜드 계정으로 다시 로그인합니다.');
    }
  }, [notify, operatingCompanyId]);

  const applySplitLayout = useCallback(async () => {
    await applyTelecrmSoomgoSplitLayout(arrangeSoomgoBridgeLayout, { resizeCrm: isPopup });
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

  const handleChatAlerts = useCallback(
    async (alerts: SoomgoChatAlert[]) => {
      if (alerts.length === 0) return;
      onChatAlerts?.(alerts);
      try {
        await ackSoomgoChatAlerts(alerts.map((a) => a.id));
      } catch {
        /* 브릿지 재시도 시 중복 merge는 inbox id로 방지 */
      }
    },
    [onChatAlerts],
  );

  const triggerBridgeUpdate = useCallback(
    (mode: 'prompt' | 'background' | 'install', statusForGate?: SoomgoBridgeStatus | null) => {
      if (statusForGate && !isSoomgoBridgeCrmManifestPassthroughSupported(statusForGate)) {
        return;
      }
      if (refreshManifest) {
        void requestSoomgoBridgeUpdateFresh(refreshManifest, mode);
      } else {
        void requestSoomgoBridgeUpdate(mode, bridgeManifest);
      }
    },
    [bridgeManifest, refreshManifest],
  );

  const refreshStatus = useCallback(async (options?: { lite?: boolean }) => {
    const s = await fetchSoomgoBridgeStatus(bridgeManifest, { lite: options?.lite });
    setStatus(s);
    const blocked = isSoomgoBridgeUseBlocked(s, bridgeManifest);
    const outdatedMsg = soomgoBridgeOutdatedMessage(s, bridgeManifest);
    if (!blocked) {
      if (useBlockedRef.current) {
        useBlockedRef.current = false;
        outdatedNotifiedRef.current = false;
        softUpdateNotifiedRef.current = false;
        watchBlockedRef.current = false;
        setError(null);
        notify('숨고 연동 업데이트가 반영되었습니다.');
        if (pendingSoomgoReconnectRef.current || soomgoBarOpenRef.current) {
          pendingSoomgoReconnectRef.current = false;
          window.setTimeout(() => {
            void openSoomgoRef.current?.();
          }, 800);
        }
      } else {
        watchBlockedRef.current = false;
        outdatedNotifiedRef.current = false;
        setError((prev) =>
          prev && (prev.includes('API 업데이트') || prev === SOOMGO_BRIDGE_OUTDATED_MESSAGE || prev.includes('새 버전'))
            ? null
            : prev,
        );
      }
    }
    if (isSoomgoBridgeOutdated(s, bridgeManifest) && !outdatedNotifiedRef.current) {
      outdatedNotifiedRef.current = true;
      softUpdateNotifiedRef.current = true;
      useBlockedRef.current = true;
      watchBlockedRef.current = true;
      setError(outdatedMsg);
      notify(outdatedMsg);
      void triggerBridgeUpdate('install', s);
    } else if (
      isSoomgoAppUpdateAvailable(s, bridgeManifest) &&
      !softUpdateNotifiedRef.current &&
      !isSoomgoBridgeOutdated(s, bridgeManifest)
    ) {
      softUpdateNotifiedRef.current = true;
      useBlockedRef.current = true;
      watchBlockedRef.current = true;
      const softMsg = soomgoBridgeSoftUpdateMessage(s, bridgeManifest);
      if (softMsg) {
        setError(softMsg);
        notify(softMsg);
      }
      void triggerBridgeUpdate('background', s);
    }
    if (s.pendingCallPhone && s.pendingCallAt != null && !blocked) {
      void handlePendingCall(s);
    }
    if (s.chatAlerts?.length && isSoomgoBridgeChatAlertsSupported(s) && !blocked) {
      void handleChatAlerts(s.chatAlerts);
    }
    return s;
  }, [bridgeManifest, handleChatAlerts, handlePendingCall, notify, triggerBridgeUpdate]);

  const ensureChatWatch = useCallback(
    async (s: SoomgoBridgeStatus) => {
      if (
        !s.loggedIn ||
        chatWatchStartedRef.current ||
        watchBlockedRef.current ||
        isSoomgoBridgeUseBlocked(s, bridgeManifest) ||
        !isSoomgoBridgeChatAlertsSupported(s)
      ) {
        return;
      }
      try {
        await watchSoomgoChatList();
        chatWatchStartedRef.current = true;
      } catch {
        chatWatchStartedRef.current = true;
      }
    },
    [bridgeManifest],
  );

  const ensureCallWatch = useCallback(
    async (s: SoomgoBridgeStatus) => {
      if (
        !s.inChatRoom ||
        watchStartedRef.current ||
        watchBlockedRef.current ||
        isSoomgoBridgeUseBlocked(s, bridgeManifest)
      ) {
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
      if (s.inChatRoom && s.bridgeRunning && !isSoomgoBridgeUseBlocked(s, bridgeManifest) && !watchBlockedRef.current) {
        void ensureCallWatch(s);
      } else if (!s.inChatRoom) {
        watchStartedRef.current = false;
      }
      if (s.loggedIn && s.bridgeRunning && !isSoomgoBridgeUseBlocked(s, bridgeManifest)) {
        void ensureChatWatch(s);
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
      if (isSoomgoBridgeUseBlocked(current, bridgeManifest)) {
        const outdatedMsg = soomgoBridgeOutdatedMessage(current, bridgeManifest);
        pendingSoomgoReconnectRef.current = true;
        let manifest = bridgeManifest;
        if (refreshManifest) {
          manifest = (await refreshManifest()) ?? manifest;
        }
        const via = await installSoomgoBridgeFromCrmManifest('install', manifest, current);
        if (via === 'browser') {
          const latest = manifest?.latestVersion?.trim();
          notify(
            latest
              ? `v${latest} 설치 파일을 열었습니다. 설치 후 「청소비서 숨고 연동」을 다시 실행해 주세요.`
              : '설치 파일을 열었습니다. 설치 후 프로그램을 다시 실행해 주세요.',
          );
        }
        throw new Error(outdatedMsg);
      }
      pendingSoomgoReconnectRef.current = false;
      if (isPopup) arrangeCrmPopupLeftHalf();
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      const screen = readSoomgoSplitBoundsAfterCrmResize();
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
      await ensureChatWatch(finalStatus);
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
  }, [applySplitLayout, bridgeManifest, ensureCallWatch, ensureChatWatch, isPopup, notify, operatingCompanyId, refreshManifest, refreshStatus]);

  openSoomgoRef.current = openSoomgo;

  const requestBridgeUpdate = useCallback(
    async (mode: 'prompt' | 'background' | 'install' = 'install') => {
      if (soomgoBarOpenRef.current) pendingSoomgoReconnectRef.current = true;
      let manifest = bridgeManifest;
      if (refreshManifest) {
        manifest = (await refreshManifest()) ?? manifest;
      }
      const current = await refreshStatus({ lite: true });
      const via = await installSoomgoBridgeFromCrmManifest(mode, manifest, current);
      if (via === 'browser') {
        const latest = manifest?.latestVersion?.trim();
        notify(
          latest
            ? `v${latest} 설치 파일을 열었습니다. 다운로드·실행 후 「청소비서 숨고 연동」을 다시 켜 주세요.`
            : '설치 파일을 열었습니다. 설치 후 프로그램을 다시 실행해 주세요.',
        );
      }
      window.setTimeout(() => {
        void refreshStatus();
      }, 1500);
    },
    [bridgeManifest, notify, refreshManifest, refreshStatus],
  );

  const openChatRoom = useCallback(
    async (chatId: string) => {
      setBusyAction('open');
      setError(null);
      try {
        const current = await refreshStatus({ lite: true });
        if (isSoomgoBridgeUseBlocked(current, bridgeManifest)) {
          throw new Error(soomgoBridgeOutdatedMessage(current, bridgeManifest));
        }
        notify('숨고 채팅방을 여는 중입니다…');
        await openSoomgoChatRoom(chatId);
        await refreshStatus();
        notify('숨고 채팅방을 열었습니다.');
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '채팅방을 열지 못했습니다.';
        setError(msg);
        notify(msg);
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [bridgeManifest, notify, refreshStatus],
  );

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
    openChatRoom,
    requestBridgeUpdate,
    chatAlertsSupported: isSoomgoBridgeChatAlertsSupported(status),
  };
}
