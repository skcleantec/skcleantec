import type { SoomgoBridgeStatus, SoomgoExtractedChat, SoomgoBridgeManifest } from '@shared/soomgoBridge';
import {
  SOOMGO_BRIDGE_BASE_URL,
  SOOMGO_BRIDGE_MIN_VERSION,
  SOOMGO_BRIDGE_SEQUENCE_MIN_VERSION,
  compareSoomgoSemver,
  isSoomgoAppOutdated,
} from '@shared/soomgoBridge';
import type { SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import type { SoomgoSplitScreenBounds } from '../utils/crmSoomgoSplitLayout';

export type SoomgoBusyAction = 'open' | 'extract' | 'call';

export const SOOMGO_BUSY_LABELS: Record<SoomgoBusyAction, string> = {
  open: '숨고 연결 중…',
  extract: '숨고 정보 가져오는 중…',
  call: '숨고 안심번호 가져오는 중…',
};

export const SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE =
  '숨고 연동 프로그램이 실행 중이 아닙니다. PC에서「청소비서 숨고 연동」을 실행한 뒤 다시 시도해 주세요.';

export const SOOMGO_BRIDGE_OUTDATED_MESSAGE =
  '숨고 연동 프로그램 업데이트가 필요합니다. 「업데이트」 또는 「설치」로 최신 버전을 설치한 뒤 다시 연결해 주세요.';

export function soomgoBridgeOutdatedMessage(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): string {
  const latest = manifest?.latestVersion?.trim();
  const current = status?.appVersion?.trim();
  if (latest && current && isSoomgoAppOutdated(current, manifest)) {
    return `숨고 연동 v${current} → v${latest} 업데이트가 필요합니다. 「업데이트」 또는 「설치」를 눌러 주세요.`;
  }
  return SOOMGO_BRIDGE_OUTDATED_MESSAGE;
}

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

export function isSoomgoBridgeOutdated(
  status: SoomgoBridgeStatus | null | undefined,
  manifest?: SoomgoBridgeManifest | null,
): boolean {
  if (!status?.bridgeRunning) return false;
  const v = status.bridgeVersion;
  if (v == null || v < SOOMGO_BRIDGE_MIN_VERSION) return true;
  return isSoomgoAppOutdated(status.appVersion, manifest);
}

export async function fetchSoomgoBridgeStatus(
  manifest?: SoomgoBridgeManifest | null,
): Promise<SoomgoBridgeStatus> {
  try {
    const status = await bridgeFetch<SoomgoBridgeStatus>('/status');
    if (isSoomgoBridgeOutdated(status, manifest)) {
      return { ...status, lastError: soomgoBridgeOutdatedMessage(status, manifest) };
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

export const SOOMGO_BRIDGE_SEQUENCE_OUTDATED_MESSAGE =
  '숨고 연동 v2.1.0 이상이 필요합니다. 설정에서 프로그램을 업데이트한 뒤 프리셋 전송을 사용해 주세요.';

export function isSoomgoBridgeSequenceSupported(status: SoomgoBridgeStatus | null | undefined): boolean {
  const current = status?.appVersion?.trim();
  if (!current) return false;
  return compareSoomgoSemver(current, SOOMGO_BRIDGE_SEQUENCE_MIN_VERSION) >= 0;
}

export async function sendSoomgoBridgeMessage(message: string): Promise<void> {
  await bridgeFetch<{ ok: boolean }>('/send-message', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function sendSoomgoBridgeSequence(
  steps: SoomgoMessageStep[],
  status?: SoomgoBridgeStatus | null,
): Promise<void> {
  if (!isSoomgoBridgeSequenceSupported(status)) {
    throw new Error(SOOMGO_BRIDGE_SEQUENCE_OUTDATED_MESSAGE);
  }
  await bridgeFetch<{ ok: boolean }>('/send-sequence', {
    method: 'POST',
    body: JSON.stringify({ steps }),
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

export async function requestSoomgoBridgeUpdate(): Promise<void> {
  try {
    await bridgeFetch<{ ok: boolean }>('/request-update', { method: 'POST', body: '{}' });
  } catch {
    /* 트레이 미실행 시 무시 */
  }
}

export async function requestSoomgoBridgeRestart(mode: 'bridge' | 'desktop' = 'bridge'): Promise<void> {
  await bridgeFetch<{ ok: boolean }>('/restart-bridge', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
