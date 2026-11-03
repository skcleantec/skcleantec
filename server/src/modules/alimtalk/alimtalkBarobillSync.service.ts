import type { Prisma } from '@prisma/client';
import { ALIMTALK_TEMPLATE_CODES, type AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import {
  barobillKakaoChannelId,
  describeBarobillKakaoConfigGap,
  getChannels,
  getPartnerBalance,
  getTemplates,
  missingBarobillKakaoEnv,
  type BarobillKakaoButton,
  type BarobillKakaoChannel,
  type BarobillKakaoTemplate,
} from '../../lib/barobill/kakaotalk.js';
import { BarobillCallError, formatBarobillCallError } from '../../lib/barobill/soap.js';
import { prisma } from '../../lib/prisma.js';
import { notifyPlatformOps } from '../platform/platformInboxNotify.service.js';
import { ALIMTALK_FILLABLE_VARIABLES } from './alimtalkTemplateRegistry.js';

/** 서식 코드 ↔ 바로빌 템플릿명. 본문은 동기화로만 채운다. */
export const BAROBILL_TEMPLATE_NAME_BY_CODE: Record<AlimtalkTemplateCode, string> = {
  CBISEO_CUST_ORDER_LINK: '[고객] 발주서 작성·예약 안내',
  CBISEO_CUST_ORDER_DONE: '[고객] 예약(발주서) 접수 완료',
  CBISEO_CUST_SCHEDULE_D2: '[고객] 예약 일정 확인(무위약 마감일)',
};

const SYNC_INTERVAL_MS = 20 * 60 * 60 * 1000;
const VARIABLE_RE = /#\{[^}]+\}/g;
const FILLABLE = new Set<string>(ALIMTALK_FILLABLE_VARIABLES);

export function barobillTemplateStatusLabel(status: number | null | undefined): string {
  if (status == null) return '미동기화';
  if (status === 3) return '정상';
  return `심사 ${status}`;
}

export function barobillChannelStatusLabel(status: number | null | undefined): string {
  if (status == null) return '확인 전';
  if (status === 1) return '정상';
  return `상태 ${status}`;
}

function publicCallError(err: unknown): string {
  if (err instanceof BarobillCallError) return formatBarobillCallError(err);
  if (err instanceof Error) return err.message;
  return '바로빌 조회에 실패했습니다.';
}

function unknownVariables(text: string): string[] {
  const found = text.match(VARIABLE_RE) ?? [];
  return [...new Set(found.filter((token) => !FILLABLE.has(token)))];
}

function templateVariableWarnings(template: BarobillKakaoTemplate): string[] {
  const chunks = [
    template.TemplateContent,
    template.TemplateTitle,
    template.TemplateSubtitle,
    template.TemplateExtra,
    ...template.Buttons.flatMap((button) => [button.Name, button.Url1, button.Url2]),
  ];
  return [...new Set(chunks.flatMap(unknownVariables))];
}

function buttonsJson(buttons: BarobillKakaoButton[]): Prisma.InputJsonValue {
  return buttons.map((button) => ({
    ButtonType: button.ButtonType,
    Name: button.Name,
    Url1: button.Url1,
    Url2: button.Url2,
  }));
}

export type BarobillTemplateSyncRow = {
  code: AlimtalkTemplateCode;
  templateName: string;
  status: number | null;
  statusLabel: string;
  warnings: string[];
  saved: boolean;
};

export type BarobillAlimtalkSyncResult = {
  configGap: string | null;
  channelStatus: number | null;
  channelStatusLabel: string;
  templates: BarobillTemplateSyncRow[];
  missing: string[];
  notified: boolean;
  skipped?: 'recent';
};

async function notifyIfReviewBlocked(input: {
  channel: BarobillKakaoChannel | null;
  rows: BarobillTemplateSyncRow[];
}): Promise<boolean> {
  const problems: string[] = [];
  if (!input.channel) problems.push('채널을 찾지 못했습니다.');
  else if (input.channel.Status !== 1) {
    problems.push(`채널 상태 ${barobillChannelStatusLabel(input.channel.Status)}`);
  }
  for (const row of input.rows) {
    if (row.status !== 3) problems.push(`${row.templateName}: ${row.statusLabel}`);
  }
  if (problems.length === 0) return false;
  await notifyPlatformOps({
    event: 'alimtalk_barobill',
    tenantLabel: '청소비서',
    title: '바로빌 알림톡 심사 확인',
    body: problems.join(' · '),
    email: true,
  });
  return true;
}

export async function syncBarobillAlimtalkTemplates(options?: {
  force?: boolean;
}): Promise<BarobillAlimtalkSyncResult> {
  const configGap = describeBarobillKakaoConfigGap();
  if (configGap) {
    return {
      configGap,
      channelStatus: null,
      channelStatusLabel: '확인 전',
      templates: [],
      missing: [],
      notified: false,
    };
  }

  if (!options?.force) {
    const latest = await prisma.alimtalkTemplate.aggregate({ _max: { barobillSyncedAt: true } });
    const syncedAt = latest._max.barobillSyncedAt;
    if (syncedAt && Date.now() - syncedAt.getTime() < SYNC_INTERVAL_MS) {
      return {
        configGap: null,
        channelStatus: null,
        channelStatusLabel: '확인 전',
        templates: [],
        missing: [],
        notified: false,
        skipped: 'recent',
      };
    }
  }

  const channelId = barobillKakaoChannelId();
  const channels = await getChannels();
  const channel = channels.find((row) => row.ChannelId === channelId) ?? null;
  const remote = await getTemplates(channelId);
  const byName = new Map(remote.map((row) => [row.TemplateName, row]));
  const templates: BarobillTemplateSyncRow[] = [];
  const missing: string[] = [];

  for (const code of ALIMTALK_TEMPLATE_CODES) {
    const templateName = BAROBILL_TEMPLATE_NAME_BY_CODE[code];
    const found = byName.get(templateName);
    if (!found) {
      missing.push(templateName);
      templates.push({
        code,
        templateName,
        status: null,
        statusLabel: '없음',
        warnings: [],
        saved: false,
      });
      continue;
    }
    const warnings = templateVariableWarnings(found);
    const subtitle = [found.TemplateSubtitle, found.TemplateExtra].filter((part) => part.trim()).join('\n');
    await prisma.alimtalkTemplate.update({
      where: { code },
      data: {
        barobillTemplateName: found.TemplateName,
        barobillContent: found.TemplateContent,
        barobillTitle: found.TemplateTitle,
        barobillSubtitle: subtitle,
        barobillButtonsJson: buttonsJson(found.Buttons),
        barobillStatus: found.Status,
        barobillSyncedAt: new Date(),
      },
    });
    templates.push({
      code,
      templateName,
      status: found.Status,
      statusLabel: barobillTemplateStatusLabel(found.Status),
      warnings,
      saved: true,
    });
  }

  let notified = false;
  try {
    notified = await notifyIfReviewBlocked({ channel, rows: templates });
  } catch (err) {
    console.error('[alimtalk-barobill] notify failed', err instanceof Error ? err.name : 'error');
  }

  return {
    configGap: null,
    channelStatus: channel?.Status ?? null,
    channelStatusLabel: barobillChannelStatusLabel(channel?.Status),
    templates,
    missing,
    notified,
  };
}

export type BarobillAlimtalkOverview = {
  configGap: string | null;
  missingEnv: string[];
  channel: { channelId: string; channelName: string; status: number; statusLabel: string } | null;
  channels: { channelId: string; channelName: string; status: number; statusLabel: string }[];
  balanceKrw: number | null;
  callError: string | null;
  templates: {
    code: string;
    name: string;
    provider: string;
    barobillTemplateName: string | null;
    barobillStatus: number | null;
    barobillStatusLabel: string;
    barobillSyncedAt: string | null;
    barobillReady: boolean;
  }[];
};

export async function loadBarobillAlimtalkOverview(): Promise<BarobillAlimtalkOverview> {
  const missingEnv = missingBarobillKakaoEnv();
  const configGap = describeBarobillKakaoConfigGap();
  const rows = await prisma.alimtalkTemplate.findMany({
    where: { code: { in: [...ALIMTALK_TEMPLATE_CODES] } },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      provider: true,
      barobillTemplateName: true,
      barobillStatus: true,
      barobillSyncedAt: true,
    },
  });
  const templates = rows.map((row) => ({
    code: row.code,
    name: row.name,
    provider: row.provider === 'barobill' ? 'barobill' : 'solapi',
    barobillTemplateName: row.barobillTemplateName,
    barobillStatus: row.barobillStatus,
    barobillStatusLabel: barobillTemplateStatusLabel(row.barobillStatus),
    barobillSyncedAt: row.barobillSyncedAt?.toISOString() ?? null,
    barobillReady: row.barobillStatus === 3,
  }));

  if (missingEnv.includes('BAROBILL_CERTKEY')) {
    return { configGap, missingEnv, channel: null, channels: [], balanceKrw: null, callError: null, templates };
  }

  let channels: BarobillKakaoChannel[] = [];
  let balanceKrw: number | null = null;
  let callError: string | null = null;
  try {
    channels = await getChannels();
  } catch (err) {
    callError = publicCallError(err);
  }
  try {
    balanceKrw = await getPartnerBalance();
  } catch (err) {
    callError = callError ?? publicCallError(err);
  }

  const wanted = process.env.BAROBILL_KAKAO_CHANNEL_ID?.trim() ?? '';
  const matched = wanted ? channels.find((row) => row.ChannelId === wanted) ?? null : channels[0] ?? null;
  return {
    configGap,
    missingEnv,
    channel: matched
      ? {
          channelId: matched.ChannelId,
          channelName: matched.ChannelName,
          status: matched.Status,
          statusLabel: barobillChannelStatusLabel(matched.Status),
        }
      : null,
    channels: channels.map((row) => ({
      channelId: row.ChannelId,
      channelName: row.ChannelName,
      status: row.Status,
      statusLabel: barobillChannelStatusLabel(row.Status),
    })),
    balanceKrw,
    callError,
    templates,
  };
}

export async function setAlimtalkTemplateProvider(
  code: string,
  provider: 'solapi' | 'barobill',
): Promise<{ code: string; provider: string }> {
  if (!ALIMTALK_TEMPLATE_CODES.includes(code as AlimtalkTemplateCode)) {
    throw new Error('알림톡 서식을 찾을 수 없습니다.');
  }
  const row = await prisma.alimtalkTemplate.findFirst({
    where: { code },
    select: { code: true, barobillStatus: true },
  });
  if (!row) throw new Error('알림톡 서식을 찾을 수 없습니다.');
  if (provider === 'barobill' && row.barobillStatus !== 3) {
    throw new Error('바로빌 심사가 정상일 때만 바로빌로 바꿀 수 있습니다.');
  }
  await prisma.alimtalkTemplate.update({
    where: { code: row.code },
    data: { provider },
  });
  return { code: row.code, provider };
}
