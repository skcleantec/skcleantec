import type { MisoBridgeStatus, MisoExtractPayload, MisoOpenChatsResult, MisoSendMessageResult } from '@shared/misoBridge';
import { MISO_BRIDGE_BASE_URL, MISO_BRIDGE_MIN_VERSION } from '@shared/misoBridge';

export const MISO_BRIDGE_NOT_RUNNING_MESSAGE =
  '미소 연동 프로그램이 실행 중이 아닙니다. PC에서 `tools\\miso-bridge\\run-bridge.bat`(또는 청소비서 미소 연동)을 실행한 뒤 다시 시도해 주세요.';

export type MisoBusyAction = 'open' | 'extract' | 'send';

export const MISO_BUSY_LABELS: Record<MisoBusyAction, string> = {
  open: '미소 채팅 연결 중…',
  extract: '미소 정보 가져오는 중…',
  send: '미소 메시지 전송 중…',
};

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

let bridgeFetchChain: Promise<unknown> = Promise.resolve();

function withBridgeFetchQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = bridgeFetchChain.then(fn, fn);
  bridgeFetchChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function bridgeFetch<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  return withBridgeFetchQueue(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${MISO_BRIDGE_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });
      const data = (await res.json()) as T & { error?: string; ok?: boolean; code?: string };
      if (res.status === 404) {
        throw new Error('미소 브릿지 API를 찾을 수 없습니다.');
      }
      if (!res.ok && res.status >= 500 && res.status !== 503) {
        throw new Error(data.error ?? `브릿지 오류 (${res.status})`);
      }
      return data;
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error('미소 브릿지 응답 시간이 초과되었습니다.');
      }
      if (isBridgeConnectionError(err)) {
        throw new Error(MISO_BRIDGE_NOT_RUNNING_MESSAGE);
      }
      throw err instanceof Error ? err : new Error('미소 브릿지 통신에 실패했습니다.');
    } finally {
      window.clearTimeout(timer);
    }
  });
}

export async function openMisoChats(options?: { forceLaunch?: boolean }): Promise<MisoOpenChatsResult> {
  try {
    const res = await bridgeFetch<MisoOpenChatsResult>('/open-chats', {
      method: 'POST',
      body: JSON.stringify(options?.forceLaunch ? { forceLaunch: true } : {}),
    }, 120_000);
    return {
      ok: Boolean(res.ok),
      items: res.items ?? [],
      count: res.count,
      openedAt: res.openedAt,
      error: res.error,
      code: res.code,
    };
  } catch (e) {
    return {
      ok: false,
      items: [],
      error: e instanceof Error ? e.message : '미소 채팅 목록 연결에 실패했습니다.',
    };
  }
}

export function isMisoBridgeReachable(status: MisoBridgeStatus | null | undefined): boolean {
  return Boolean(status?.bridgeRunning);
}

export function isMisoBridgeApiOutdated(status: MisoBridgeStatus | null | undefined): boolean {
  const v = status?.bridgeVersion;
  if (v == null || !Number.isFinite(v)) return false;
  return v < MISO_BRIDGE_MIN_VERSION;
}

export async function fetchMisoBridgeStatus(options?: { lite?: boolean }): Promise<MisoBridgeStatus> {
  try {
    const lite = options?.lite ? '?lite=1' : '';
    const status = await bridgeFetch<MisoBridgeStatus>(`/status${lite}`);
    return {
      ...status,
      bridgeRunning: Boolean(status.ok),
      lastError: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : MISO_BRIDGE_NOT_RUNNING_MESSAGE;
    return {
      ok: false,
      bridgeRunning: false,
      adbConnected: false,
      emulatorReady: false,
      misoInstalled: false,
      lastError: msg,
    };
  }
}

export async function extractMisoCurrentChat(chatId?: string | null): Promise<MisoExtractPayload> {
  try {
    const body = chatId?.trim() ? JSON.stringify({ chatId: chatId.trim() }) : '{}';
    const res = await bridgeFetch<MisoExtractPayload>(
      '/extract',
      { method: 'POST', body },
      180_000,
    );
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '미소 정보 가져오기에 실패했습니다.',
    };
  }
}

export async function sendMisoBridgeMessage(
  message: string,
  chatId?: string | null,
): Promise<MisoSendMessageResult> {
  try {
    const body: { message: string; chatId?: string } = { message };
    if (chatId?.trim()) body.chatId = chatId.trim();
    const res = await bridgeFetch<MisoSendMessageResult>(
      '/send-message',
      { method: 'POST', body: JSON.stringify(body) },
      120_000,
    );
    return {
      ok: Boolean(res.ok),
      sentAt: res.sentAt,
      error: res.error,
      code: res.code,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : '미소 메시지 전송에 실패했습니다.',
    };
  }
}

export async function startMisoEmulator(): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    return await bridgeFetch<{ ok: boolean; message?: string; error?: string }>('/emulator/start', {
      method: 'POST',
      body: '{}',
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '에뮬레이터 시작 요청에 실패했습니다.' };
  }
}
