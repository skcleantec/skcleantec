import { applyPlaceholdersToSoomgoSteps } from '@shared/telecrmSoomgoFollowupAuto';
import { soomgoAutoTriggerForIntakeKind } from '@shared/soomgoMessagePresets';
import type { SoomgoIntakeAutoTriggerKind } from '@shared/soomgoMessagePresets';
import { resolveTelecrmSoomgoIntakeAutoMessageForSend } from '../api/telecrmSoomgoMessagePresets';
import { fetchSoomgoBridgeStatus, sendSoomgoBridgeSequence } from '../api/soomgoBridge';
import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';

export type SoomgoFollowupAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'bridge' | 'skipped' }
  | { sent: false; reason: 'error'; message: string };

export function invalidateSoomgoFollowupAutoConfigCache(): void {
  /* resolve API 직접 호출 — 캐시 없음 */
}

/** 접수란 저장 직후 — 처리 구분·작업 브랜드별 프리셋 ON이면 숨고 채팅 자동 전송 */
export async function trySoomgoFollowupAutoMessage(
  token: string,
  kind: CrmIntakeKind,
  ctx: { customerName: string; nickname: string; operatingCompanyId?: string | null },
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

    const status = await fetchSoomgoBridgeStatus();
    await sendSoomgoBridgeSequence(steps, status);
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : '숨고 자동 안내 전송 실패';
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

export function noticeForSoomgoFollowupAutoSend(result: SoomgoFollowupAutoSendResult): string | null {
  if (result.sent) return '숨고 채팅으로 자동 안내를 보냈습니다.';
  if (result.reason === 'bridge') {
    return '저장했습니다. 숨고 자동 안내는 전송되지 않았습니다 — 숨고 연동·채팅창을 확인해 주세요.';
  }
  if (result.reason === 'error') return result.message;
  return null;
}
