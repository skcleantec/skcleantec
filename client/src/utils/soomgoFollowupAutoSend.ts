import { applyPlaceholdersToSoomgoSteps } from '@shared/telecrmSoomgoFollowupAuto';
import { soomgoAutoTriggerForIntakeKind } from '@shared/soomgoMessagePresets';
import type { SoomgoIntakeAutoTriggerKind } from '@shared/soomgoMessagePresets';
import { resolveTelecrmSoomgoIntakeAutoMessageForSend } from '../api/telecrmSoomgoMessagePresets';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import { sendSoomgoBridgeSequence } from '../api/soomgoBridge';
import {
  resolveSoomgoSendStatus,
  soomgoSendErrorMessage,
  soomgoSendPreflightMessage,
} from './soomgoBridgeSendGuard';
import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';

export type SoomgoFollowupAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'skipped' }
  | { sent: false; reason: 'bridge' | 'error'; message: string };

export function invalidateSoomgoFollowupAutoConfigCache(): void {
  /* resolve API 직접 호출 — 캐시 없음 */
}

/** 접수란 저장 직후 — 처리 구분·작업 브랜드별 프리셋 ON이면 숨고 채팅 자동 전송 */
export async function trySoomgoFollowupAutoMessage(
  token: string,
  kind: CrmIntakeKind,
  ctx: { customerName: string; nickname: string; marketerName?: string; operatingCompanyId?: string | null },
  bridgeStatus?: SoomgoBridgeStatus | null,
): Promise<SoomgoFollowupAutoSendResult> {
  const triggerKind = soomgoAutoTriggerForIntakeKind(kind);
  if (!triggerKind || triggerKind === 'auto_quote') return { sent: false, reason: 'skipped' };
  const intakeTrigger = triggerKind as SoomgoIntakeAutoTriggerKind;

  try {
    const { item: preset } = await resolveTelecrmSoomgoIntakeAutoMessageForSend(
      token,
      intakeTrigger,
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

export function noticeForSoomgoFollowupAutoSend(result: SoomgoFollowupAutoSendResult): string | null {
  if (result.sent) return '숨고 채팅으로 자동 안내를 보냈습니다.';
  if (result.reason === 'bridge' || result.reason === 'error') {
    return `저장했습니다. 숨고 자동 안내는 보내지 못했어요. ${result.message}`;
  }
  return null;
}
