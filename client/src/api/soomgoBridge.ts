import type { SoomgoBridgeStatus, SoomgoExtractedChat } from '@shared/soomgoBridge';
import { SOOMGO_BRIDGE_BASE_URL, SOOMGO_BRIDGE_MIN_VERSION } from '@shared/soomgoBridge';
import type { SoomgoSplitScreenBounds } from '../utils/crmSoomgoSplitLayout';

export const SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE =
  '숨고 브릿지가 실행 중이 아닙니다. PC에서 tools\\soomgo-bridge\\run-bridge.bat 을 실행한 뒤 다시 시도해 주세요.';

export const SOOMGO_BRIDGE_OUTDATED_MESSAGE =
  '숨고 브릿지가 구버전입니다. run-bridge.bat 창을 닫고 다시 실행한 뒤 CRM을 새로고침해 주세요.';

function isBridgeConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg === 'failed to fetch' ||
    msg.includes('networkerror') ||
    msg.includes('connection refused') ||
    msg.includes('load failed')
  );
}

function bridgeConnectionError(): Error {
  return new Error(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
}

function bridgeOutdatedError(): Error {
  return new Error(SOOMGO_BRIDGE_OUTDATED_MESSAGE);
}

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SOOMGO_BRIDGE_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    if (isBridgeConnectionError(err)) throw bridgeConnectionError();
    throw err instanceof Error ? err : new Error('숨고 브릿지 통신에 실패했습니다.');
  }
  const data = (await res.json()) as T & { error?: string; ok?: boolean };
  if (res.status === 404) {
    throw bridgeOutdatedError();
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `브릿지 오류 (${res.status})`);
  }
  return data;
}

export function isSoomgoBridgeReachable(status: SoomgoBridgeStatus | null | undefined): boolean {
  return Boolean(status?.bridgeRunning);
}

export function isSoomgoBridgeOutdated(status: SoomgoBridgeStatus | null | undefined): boolean {
  if (!status?.bridgeRunning) return false;
  const v = status.bridgeVersion;
  return v == null || v < SOOMGO_BRIDGE_MIN_VERSION;
}

export async function fetchSoomgoBridgeStatus(): Promise<SoomgoBridgeStatus> {
  try {
    const status = await bridgeFetch<SoomgoBridgeStatus>('/status');
    if (isSoomgoBridgeOutdated(status)) {
      return { ...status, lastError: SOOMGO_BRIDGE_OUTDATED_MESSAGE };
    }
    return status;
  } catch (e) {
    if (e instanceof Error && e.message === SOOMGO_BRIDGE_OUTDATED_MESSAGE) {
      return {
        ok: false,
        bridgeRunning: true,
        browserRunning: false,
        loggedIn: false,
        lastError: SOOMGO_BRIDGE_OUTDATED_MESSAGE,
      };
    }
    return {
      ok: false,
      bridgeRunning: false,
      browserRunning: false,
      loggedIn: false,
      lastError: SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
    };
  }
}

export async function startSoomgoBridge(screen?: SoomgoSplitScreenBounds): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/start', {
    method: 'POST',
    body: JSON.stringify(screen ? { screen } : {}),
  });
}

export async function arrangeSoomgoBridgeLayout(screen: SoomgoSplitScreenBounds): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/arrange-layout', {
    method: 'POST',
    body: JSON.stringify({ screen }),
  });
}

export async function loginSoomgoBridge(email: string, password: string): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function openSoomgoChats(screen?: SoomgoSplitScreenBounds): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/open-chats', {
    method: 'POST',
    body: JSON.stringify(screen ? { screen } : {}),
  });
}

export async function extractSoomgoCurrentChat(): Promise<SoomgoExtractedChat> {
  const res = await bridgeFetch<{ ok: boolean; data: SoomgoExtractedChat }>('/extract', {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

export async function sendSoomgoBridgeMessage(message: string): Promise<void> {
  await bridgeFetch<{ ok: boolean }>('/send-message', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function watchSoomgoCallButton(): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/watch-call-button', { method: 'POST', body: '{}' });
}

export async function ackSoomgoPendingCall(pendingCallAt: number): Promise<void> {
  await bridgeFetch<{ ok: boolean }>('/ack-pending-call', {
    method: 'POST',
    body: JSON.stringify({ pendingCallAt }),
  });
}

export async function openSoomgoCallModal(): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/open-call-modal', { method: 'POST', body: '{}' });
}

export async function extractSoomgoCallNumber(): Promise<string> {
  const res = await bridgeFetch<{ ok: boolean; phone: string }>('/extract-call-number', {
    method: 'POST',
    body: '{}',
  });
  return res.phone;
}
