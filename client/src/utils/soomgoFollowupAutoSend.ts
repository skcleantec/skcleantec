import type { TelecrmSoomgoFollowupAutoMessages } from '@shared/telecrmSoomgoFollowupAuto';
import {
  applyTelecrmSoomgoFollowupPlaceholders,
  EMPTY_TELECRM_SOOMGO_FOLLOWUP_AUTO,
} from '@shared/telecrmSoomgoFollowupAuto';
import { fetchTelecrmSoomgoConfig } from '../api/telecrmSoomgo';
import { sendSoomgoBridgeMessage } from '../api/soomgoBridge';
import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';

export type SoomgoFollowupAutoSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'empty' | 'bridge' | 'skipped' }
  | { sent: false; reason: 'error'; message: string };

let configCache: TelecrmSoomgoFollowupAutoMessages | null = null;
let configCacheAt = 0;
const CACHE_MS = 60_000;

async function loadFollowupAutoConfig(token: string): Promise<TelecrmSoomgoFollowupAutoMessages> {
  const now = Date.now();
  if (configCache && now - configCacheAt < CACHE_MS) return configCache;
  const cfg = await fetchTelecrmSoomgoConfig(token);
  configCache = cfg.followupAuto ?? EMPTY_TELECRM_SOOMGO_FOLLOWUP_AUTO;
  configCacheAt = now;
  return configCache;
}

export function invalidateSoomgoFollowupAutoConfigCache(): void {
  configCache = null;
  configCacheAt = 0;
}

/** 부재·보류·고민 저장 직후 — 현재 숨고 채팅방으로 자동 안내 */
export async function trySoomgoFollowupAutoMessage(
  token: string,
  kind: CrmIntakeKind,
  ctx: { customerName: string; nickname: string },
): Promise<SoomgoFollowupAutoSendResult> {
  if (kind !== 'absent' && kind !== 'hold') {
    return { sent: false, reason: 'skipped' };
  }
  try {
    const followupAuto = await loadFollowupAutoConfig(token);
    const slot = kind === 'absent' ? followupAuto.absent : followupAuto.hold;
    if (!slot.enabled) return { sent: false, reason: 'disabled' };
    const template = slot.message.trim();
    if (!template) return { sent: false, reason: 'empty' };

    const body = applyTelecrmSoomgoFollowupPlaceholders(template, ctx).trim();
    if (!body) return { sent: false, reason: 'empty' };

    await sendSoomgoBridgeMessage(body);
    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : '숨고 자동 안내 전송 실패';
    if (
      message.includes('연결') ||
      message.includes('실행') ||
      message.includes('브릿지') ||
      message.includes('127.0.0.1')
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
