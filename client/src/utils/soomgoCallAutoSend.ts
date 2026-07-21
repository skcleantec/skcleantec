import { applyPlaceholdersToSoomgoSteps } from '@shared/telecrmSoomgoFollowupAuto';
import { resolveTelecrmSoomgoCallAutoMessageForSend } from '../api/telecrmSoomgoMessagePresets';
import { fetchSoomgoBridgeStatus, sendSoomgoBridgeSequence } from '../api/soomgoBridge';
import { telecrmCall, telecrmDispatchNotice } from './telecrmNativeBridge';

export type SoomgoCallAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'bridge' | 'skipped' }
  | { sent: false; reason: 'error'; message: string };

/** CRM 통화 버튼 — 작업 브랜드·내 계정 프리셋 ON이면 숨고 채팅 자동 전송 */
export async function trySoomgoCallAutoMessage(
  token: string,
  ctx: {
    operatingCompanyId?: string | null;
    customerName?: string;
    nickname?: string;
    marketerName?: string;
  },
): Promise<SoomgoCallAutoSendResult> {
  try {
    const { item: preset } = await resolveTelecrmSoomgoCallAutoMessageForSend(
      token,
      ctx.operatingCompanyId ?? null,
    );
    if (!preset?.isActive) return { sent: false, reason: 'disabled' };
    if (!preset.steps.length) return { sent: false, reason: 'empty' };

    const steps = applyPlaceholdersToSoomgoSteps(preset.steps, ctx);
    if (!steps.length) return { sent: false, reason: 'empty' };

    const status = await fetchSoomgoBridgeStatus();
    await sendSoomgoBridgeSequence(steps, status);
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : '숨고 통화 안내 전송 실패';
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

export function noticeForSoomgoCallAutoSend(result: SoomgoCallAutoSendResult): string | null {
  if (result.sent) return '숨고 채팅으로 통화 안내를 보냈습니다.';
  if (result.reason === 'bridge') {
    return '통화는 시도했습니다. 숨고 통화 안내는 전송되지 않았습니다 — 숨고 연동·채팅창을 확인해 주세요.';
  }
  if (result.reason === 'error') return result.message;
  return null;
}

export async function runTelecrmCallWithSoomgoAuto(opts: {
  token: string;
  dialPhone: string;
  telecrmCallOpts: Parameters<typeof telecrmCall>[1];
  soomgoCtx: {
    operatingCompanyId?: string | null;
    customerName?: string;
    nickname?: string;
    marketerName?: string;
  };
}): Promise<{ autoNotice: string | null; callNotice: string | null }> {
  const autoResult = await trySoomgoCallAutoMessage(opts.token, opts.soomgoCtx);
  const autoNotice = noticeForSoomgoCallAutoSend(autoResult);
  const callResult = await telecrmCall(opts.dialPhone, opts.telecrmCallOpts);
  const callNotice = telecrmDispatchNotice(callResult, 'call');
  return { autoNotice, callNotice };
}
