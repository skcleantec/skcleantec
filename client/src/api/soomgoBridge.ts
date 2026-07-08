import type { SoomgoBridgeStatus, SoomgoExtractedChat } from '@shared/soomgoBridge';
import { SOOMGO_BRIDGE_BASE_URL } from '@shared/soomgoBridge';

export const SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE =
  '숨고 브릿지가 실행 중이 아닙니다. PC에서 tools\\soomgo-bridge\\run-bridge.bat 을 실행한 뒤 다시 시도해 주세요.';

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
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `브릿지 오류 (${res.status})`);
  }
  return data;
}

export function isSoomgoBridgeReachable(status: SoomgoBridgeStatus | null | undefined): boolean {
  return Boolean(status?.bridgeRunning);
}

export async function fetchSoomgoBridgeStatus(): Promise<SoomgoBridgeStatus> {
  try {
    return await bridgeFetch<SoomgoBridgeStatus>('/status');
  } catch {
    return {
      ok: false,
      bridgeRunning: false,
      browserRunning: false,
      loggedIn: false,
      lastError: SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE,
    };
  }
}

export async function startSoomgoBridge(): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/start', { method: 'POST', body: '{}' });
}

export async function loginSoomgoBridge(email: string, password: string): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function openSoomgoChats(): Promise<SoomgoBridgeStatus> {
  return bridgeFetch<SoomgoBridgeStatus>('/open-chats', { method: 'POST', body: '{}' });
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
