/** 발송 직전 채널 선택. DB·발송 호출 없음. 실패해도 다른 채널로 다시 보내지 않는다. */

export type BrandChannelSendInput = {
  status: string;
  providerChannelId: string | null;
} | null;

export type BrandTemplateSendInput = {
  status: string;
  providerTemplateName: string | null;
} | null;

export type AlimtalkSendChannelChoice =
  | { route: 'brand'; channelId: string; templateName: string }
  | { route: 'platform' };

const USABLE_CHANNEL = new Set(['ACTIVE', 'LINKED']);

export function chooseAlimtalkSendChannel(input: {
  channel: BrandChannelSendInput;
  template: BrandTemplateSendInput;
}): AlimtalkSendChannelChoice {
  const channelId = input.channel?.providerChannelId?.trim() ?? '';
  const templateName = input.template?.providerTemplateName?.trim() ?? '';
  const usable = input.channel != null && USABLE_CHANNEL.has(input.channel.status);
  if (usable && channelId && input.template?.status === 'APPROVED' && templateName) {
    return { route: 'brand', channelId, templateName };
  }
  return { route: 'platform' };
}

export function mapProviderTemplateStatus(status: number): 'READY' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' {
  if (status === 3) return 'APPROVED';
  if (status === 4 || status < 0) return 'REJECTED';
  if (status === 0) return 'READY';
  return 'IN_REVIEW';
}

export function normalizeSearchId(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function channelIdsMatch(searchId: string, providerChannelId: string | null, remoteChannelId: string): boolean {
  const remote = remoteChannelId.trim();
  if (!remote) return false;
  const saved = providerChannelId?.trim() ?? '';
  if (saved && saved === remote) return true;
  const wanted = normalizeSearchId(searchId).replace(/^@/, '').toLowerCase();
  const got = remote.replace(/^@/, '').toLowerCase();
  return Boolean(wanted) && wanted === got;
}
