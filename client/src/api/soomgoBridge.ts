import type { SoomgoBridgeStatus, SoomgoExtractedChat } from '@shared/soomgoBridge';
import { SOOMGO_BRIDGE_BASE_URL } from '@shared/soomgoBridge';

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SOOMGO_BRIDGE_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string; ok?: boolean };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `브릿지 오류 (${res.status})`);
  }
  return data;
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
      lastError: '숨고 브릿지가 실행 중이 아닙니다. tools/soomgo-bridge/run-bridge.bat 을 실행해 주세요.',
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
