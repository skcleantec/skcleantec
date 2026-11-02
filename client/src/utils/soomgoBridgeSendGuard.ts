import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { fetchSoomgoBridgeStatus, isSoomgoBridgeSequenceSupported } from '../api/soomgoBridge';

/** 숨고 채팅 전송(견적보내기·자동 안내) 전 상태 확인 · 실패 이유를 쉬운 말로 */

export const SOOMGO_SEND_BRIDGE_NO_RESPONSE =
  '숨고 연동 프로그램이 응답하지 않아요. 숨고 연동 창이 켜져 있는지 확인해 주세요.';
export const SOOMGO_SEND_BRIDGE_OUTDATED =
  '숨고 연동 프로그램을 최신 버전으로 업데이트한 뒤 다시 눌러 주세요.';
export const SOOMGO_SEND_BROWSER_CLOSED =
  '숨고 창이 열려 있지 않아요. 숨고 연동에서 숨고 창을 먼저 열어 주세요.';
export const SOOMGO_SEND_NOT_IN_ROOM = '숨고 창에서 고객 채팅방을 연 뒤 다시 눌러 주세요.';
export const SOOMGO_SEND_INPUT_MISSING =
  '숨고 채팅 입력창을 찾지 못했어요. 고객 채팅방이 열려 있는지 확인해 주세요.';
export const SOOMGO_SEND_NOT_SUBMITTED =
  '메시지가 입력만 되고 전송되지 않았어요. 숨고 창에서 전송 버튼을 확인해 주세요.';
export const SOOMGO_SEND_OTHER_CUSTOMER = '지금 숨고 창에 다른 고객 채팅방이 열려 있어요.';

/** 넘겨받은(폴링) 상태가 쓸 만하면 그대로, 아니면 빠른(lite) 상태 조회 */
export async function resolveSoomgoSendStatus(
  given?: SoomgoBridgeStatus | null,
): Promise<SoomgoBridgeStatus> {
  if (given?.bridgeRunning && given.appVersion?.trim()) return given;
  return fetchSoomgoBridgeStatus(undefined, { lite: true });
}

/** 전송 전에 막아야 하면 이유(쉬운 말), 보내도 되면 null */
export function soomgoSendPreflightMessage(status: SoomgoBridgeStatus): string | null {
  if (!status.bridgeRunning) return SOOMGO_SEND_BRIDGE_NO_RESPONSE;
  if (!isSoomgoBridgeSequenceSupported(status)) {
    return status.appVersion?.trim() ? SOOMGO_SEND_BRIDGE_OUTDATED : SOOMGO_SEND_BRIDGE_NO_RESPONSE;
  }
  if (status.browserRunning === false) return SOOMGO_SEND_BROWSER_CLOSED;
  if (status.inChatRoom === false) return SOOMGO_SEND_NOT_IN_ROOM;
  return null;
}

/** 전송 중 오류 → 쉬운 말 */
export function soomgoSendErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : '';
  if (!raw) return '숨고 채팅으로 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
  if (raw.includes('입력만 되고')) return SOOMGO_SEND_NOT_SUBMITTED;
  if (raw.includes('입력창') || raw.includes('첨부 입력')) return SOOMGO_SEND_INPUT_MISSING;
  if (raw.includes('채팅방을 연 뒤') || raw.includes('채팅방이 열려')) return SOOMGO_SEND_NOT_IN_ROOM;
  if (raw.includes('업데이트') || raw.includes('v2.1.0')) return SOOMGO_SEND_BRIDGE_OUTDATED;
  if (
    raw.includes('실행 중이 아닙니다') ||
    raw.includes('연결') ||
    raw.includes('브릿지') ||
    raw.includes('대기 시간') ||
    raw.includes('127.0.0.1') ||
    raw === 'timeout'
  ) {
    return SOOMGO_SEND_BRIDGE_NO_RESPONSE;
  }
  if (/[{}]|[A-Z_]{4,}|null|undefined/.test(raw)) {
    return '숨고 채팅으로 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  return raw;
}

function normName(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .replace(/(고객|님)$/u, '')
    .toLowerCase();
}

export type SoomgoRoomMatch = 'same' | 'different' | 'uncertain' | 'unknown';

/**
 * 숨고 창의 현재 채팅방이 이 고객 것인지.
 * - chatId 가 둘 다 있으면 확실히 판단(same/different)
 * - 닉네임만 비교 가능하면 same 또는 uncertain(라이트 상태의 닉네임은 늦게 바뀔 수 있음)
 */
export function matchSoomgoChatRoom(
  status: SoomgoBridgeStatus,
  expected: { chatId?: string | null; names?: (string | null | undefined)[] },
): SoomgoRoomMatch {
  const currentId = status.chatId?.trim();
  const expectedId = expected.chatId?.trim();
  if (currentId && expectedId) return currentId === expectedId ? 'same' : 'different';
  const nick = normName(status.nickname);
  const names = (expected.names ?? []).map(normName).filter(Boolean);
  if (!nick || names.length === 0) return 'unknown';
  const hit = names.some((n) => n === nick || n.includes(nick) || nick.includes(n));
  return hit ? 'same' : 'uncertain';
}
