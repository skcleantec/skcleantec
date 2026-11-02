import { applyPlaceholdersToSoomgoSteps } from '@shared/telecrmSoomgoFollowupAuto';
import { resolveTelecrmSoomgoCallAutoMessageForSend } from '../api/telecrmSoomgoMessagePresets';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { sendSoomgoBridgeSequence } from '../api/soomgoBridge';
import {
  resolveSoomgoSendStatus,
  soomgoSendErrorMessage,
  soomgoSendPreflightMessage,
} from './soomgoBridgeSendGuard';
import { telecrmCall, telecrmDispatchNotice } from './telecrmNativeBridge';

export type SoomgoCallAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'skipped' }
  | { sent: false; reason: 'bridge' | 'error'; message: string };

/** CRM 통화 버튼 — 작업 브랜드·내 계정 프리셋 ON이면 숨고 채팅 자동 전송 */
export async function trySoomgoCallAutoMessage(
  token: string,
  ctx: {
    operatingCompanyId?: string | null;
    customerName?: string;
    nickname?: string;
    marketerName?: string;
  },
  bridgeStatus?: SoomgoBridgeStatus | null,
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

    const status = await resolveSoomgoSendStatus(bridgeStatus);
    const blocked = soomgoSendPreflightMessage(status);
    if (blocked) return { sent: false, reason: 'bridge', message: blocked };
    await sendSoomgoBridgeSequence(steps, status);
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'error', message: soomgoSendErrorMessage(e) };
  }
}

export function noticeForSoomgoCallAutoSend(result: SoomgoCallAutoSendResult): string | null {
  if (result.sent) return '숨고 채팅으로 통화 안내를 보냈습니다.';
  if (result.reason === 'bridge' || result.reason === 'error') {
    return `통화는 시도했습니다. 숨고 통화 안내는 보내지 못했어요. ${result.message}`;
  }
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
  bridgeStatus?: SoomgoBridgeStatus | null;
}): Promise<{ autoNotice: string | null; callNotice: string | null }> {
  const autoResult = await trySoomgoCallAutoMessage(opts.token, opts.soomgoCtx, opts.bridgeStatus);
  const autoNotice = noticeForSoomgoCallAutoSend(autoResult);
  const callResult = await telecrmCall(opts.dialPhone, opts.telecrmCallOpts);
  const callNotice = telecrmDispatchNotice(callResult, 'call');
  return { autoNotice, callNotice };
}
