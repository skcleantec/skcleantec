import { applySoomgoQuotePlaceholdersToSteps } from '@shared/telecrmSoomgoQuotePlaceholders';
import { resolveTelecrmSoomgoQuoteAutoMessageForSend } from '../api/telecrmSoomgoMessagePresets';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { sendSoomgoBridgeSequence } from '../api/soomgoBridge';
import { confirmDialog } from '../components/ui/Toast';
import {
  matchSoomgoChatRoom,
  resolveSoomgoSendStatus,
  soomgoSendErrorMessage,
  soomgoSendPreflightMessage,
  SOOMGO_SEND_OTHER_CUSTOMER,
} from './soomgoBridgeSendGuard';

export type SoomgoQuoteAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'no_quote' | 'cancelled' | 'other_customer' }
  | { sent: false; reason: 'bridge' | 'error'; message: string };

/** CRM 견적보내기 — 설정된 숨고 서식으로 채팅 전송 */
export async function sendSoomgoQuoteAutoMessage(
  token: string,
  params: {
    operatingCompanyId: string | null;
    customerName: string;
    nickname: string;
    quoteTotalWon: number | null;
    pyeong: string;
    /** CRM 이 폴링한 숨고 연동 상태(있으면 다시 묻지 않음) */
    bridgeStatus?: SoomgoBridgeStatus | null;
    /** 숨고에서 가져올 때 열려 있던 채팅방 — 다른 고객 방에 잘못 보내지 않도록 비교 */
    expectedChatId?: string | null;
  },
): Promise<SoomgoQuoteAutoSendResult> {
  if (params.quoteTotalWon == null || !Number.isFinite(params.quoteTotalWon)) {
    return { sent: false, reason: 'no_quote' };
  }

  try {
    const { item: preset } = await resolveTelecrmSoomgoQuoteAutoMessageForSend(
      token,
      params.operatingCompanyId,
    );
    if (!preset?.isActive) return { sent: false, reason: 'disabled' };
    if (!preset.steps.length) return { sent: false, reason: 'empty' };

    const steps = applySoomgoQuotePlaceholdersToSteps(preset.steps, {
      customerName: params.customerName,
      nickname: params.nickname,
      quoteTotalWon: params.quoteTotalWon,
      paybackWon: preset.paybackWon,
      pyeong: params.pyeong,
    });
    if (!steps.length) return { sent: false, reason: 'empty' };

    const status = await resolveSoomgoSendStatus(params.bridgeStatus);
    const blocked = soomgoSendPreflightMessage(status);
    if (blocked) return { sent: false, reason: 'bridge', message: blocked };

    const match = matchSoomgoChatRoom(status, {
      chatId: params.expectedChatId,
      names: [params.nickname, params.customerName],
    });
    if (match === 'different') return { sent: false, reason: 'other_customer' };
    if (match === 'uncertain') {
      const ok = await confirmDialog({
        title: '숨고 창의 채팅방이 이 고객인지 확인해 주세요',
        body: status.nickname?.trim()
          ? `지금 열린 채팅방: ${status.nickname.trim()}`
          : '지금 열린 채팅방의 고객을 확인하지 못했어요.',
        confirmLabel: '그래도 보내기',
      });
      if (!ok) return { sent: false, reason: 'cancelled' };
    }

    await sendSoomgoBridgeSequence(steps, status);
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'error', message: soomgoSendErrorMessage(e) };
  }
}

export function noticeForSoomgoQuoteAutoSend(result: SoomgoQuoteAutoSendResult): string | null {
  if (result.sent) return '숨고 채팅으로 견적 안내를 보냈습니다.';
  if (result.reason === 'disabled') {
    return '견적보내기 서식이 꺼져 있거나 없습니다. 설정 → 숨고 프리셋 → 자동메시지에서 켜 주세요.';
  }
  if (result.reason === 'empty') {
    return '견적보내기 서식이 비어 있습니다. 설정에서 메시지를 추가해 주세요.';
  }
  if (result.reason === 'no_quote') return '합계 견적이 없습니다. 항목을 추가한 뒤 다시 시도해 주세요.';
  if (result.reason === 'other_customer') {
    return `${SOOMGO_SEND_OTHER_CUSTOMER} 이 고객 채팅방을 연 뒤 다시 눌러 주세요.`;
  }
  if (result.reason === 'cancelled') return null;
  if (result.reason === 'bridge' || result.reason === 'error') {
    return `견적을 보내지 못했어요. ${result.message}`;
  }
  return null;
}
