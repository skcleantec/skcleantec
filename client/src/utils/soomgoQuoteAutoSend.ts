import { applySoomgoQuotePlaceholdersToSteps } from '@shared/telecrmSoomgoQuotePlaceholders';
import { resolveTelecrmSoomgoQuoteAutoMessageForSend } from '../api/telecrmSoomgoMessagePresets';
import { fetchSoomgoBridgeStatus, sendSoomgoBridgeSequence } from '../api/soomgoBridge';

export type SoomgoQuoteAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'bridge' | 'no_quote' }
  | { sent: false; reason: 'error'; message: string };

/** CRM 견적보내기 — 설정된 숨고 서식으로 채팅 전송 */
export async function sendSoomgoQuoteAutoMessage(
  token: string,
  params: {
    operatingCompanyId: string | null;
    customerName: string;
    nickname: string;
    quoteTotalWon: number | null;
    pyeong: string;
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

    const status = await fetchSoomgoBridgeStatus();
    await sendSoomgoBridgeSequence(steps, status);
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : '숨고 견적보내기 전송 실패';
    if (
      message.includes('연결') ||
      message.includes('실행') ||
      message.includes('브릿지') ||
      message.includes('127.0.0.1') ||
      message.includes('v2.1.0')
    ) {
      return { sent: false, reason: 'bridge' };
    }
    return { sent: false, reason: 'error', message };
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
  if (result.reason === 'bridge') {
    return '숨고 견적보내기가 전송되지 않았습니다 — 숨고 연동·채팅창을 확인해 주세요.';
  }
  if (result.reason === 'error') return result.message;
  return null;
}
