import type { BarobillKakaoChannel, BarobillKakaoTemplate } from '../../lib/barobill/kakaotalk.js';
import { getChannels, getTemplates } from '../../lib/barobill/kakaotalk.js';
import { prisma } from '../../lib/prisma.js';
import { sendAlimtalkOpsMail } from './alimtalkBarobillOpsMail.js';
import { BAROBILL_TEMPLATE_NAME_BY_CODE } from './alimtalkBarobillSync.service.js';
import {
  brandTemplateLabel,
  notifyBrandChannelLinked,
  notifyBrandTemplatesApproved,
  notifyBrandTemplatesRejected,
} from './alimtalkBrandChannel.notify.js';
import {
  BRAND_CHANNEL_TEMPLATE_CODES,
  channelIdsMatch,
  mapProviderTemplateStatus,
} from './alimtalkBrandChannel.select.js';
const HOUR_MS = 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastCheckedAt: string | null = null;

export async function brandChannelLastCheckedAt(): Promise<string | null> {
  const row = await prisma.platformBillingSettings.findUnique({
    where: { id: 'default' },
    select: { alimtalkBrandChannelLastCheckedAt: true },
  });
  return row?.alimtalkBrandChannelLastCheckedAt?.toISOString() ?? lastCheckedAt;
}

export async function syncAlimtalkBrandChannels(): Promise<{ checked: number; disconnected: number }> {
  await prisma.alimtalkBrandTemplate.deleteMany({
    where: { templateCode: { notIn: [...BRAND_CHANNEL_TEMPLATE_CODES] } },
  });
  const remoteChannels = await getChannels();
  const locals = await prisma.alimtalkBrandChannel.findMany({
    where: { status: { in: ['REQUESTED', 'LINKED', 'ACTIVE'] } },
    include: {
      templates: true,
      tenant: { select: { name: true } },
      operatingCompany: { select: { name: true } },
    },
  });
  const gone: string[] = [];
  const now = new Date();
  for (const local of locals) {
    const hit = remoteChannels.find((row) => channelIdsMatch(local.searchId, local.providerChannelId, row.ChannelId));
    if (!hit) {
      if (local.status === 'LINKED' || local.status === 'ACTIVE') {
        await prisma.alimtalkBrandChannel.update({
          where: { id: local.id },
          data: { status: 'DISCONNECTED' },
        });
        gone.push(`${local.tenant.name} · ${local.operatingCompany.name} · ${local.searchId} · 발송 서비스 채널 목록에 없습니다.`);
      }
      continue;
    }
    if (local.status === 'REQUESTED') {
      const linked = await prisma.alimtalkBrandChannel.updateMany({
        where: { id: local.id, tenantId: local.tenantId, status: 'REQUESTED' },
        data: { status: 'LINKED', providerChannelId: hit.ChannelId, linkedAt: now },
      });
      if (linked.count === 1 && !local.linkedNotifiedAt) {
        await notifyBrandChannelLinked({
          tenantId: local.tenantId,
          channelId: local.id,
          tenantName: local.tenant.name,
          brandName: local.operatingCompany.name,
          searchId: local.searchId,
          now,
        });
      }
      await ensureReadyTemplates(local.id);
    } else if (local.providerChannelId !== hit.ChannelId) {
      await prisma.alimtalkBrandChannel.update({
        where: { id: local.id },
        data: { providerChannelId: hit.ChannelId },
      });
    }
    const changes = await refreshTemplates(local.id, local.tenantId, hit.ChannelId, now);
    if (changes.approved.length > 0 || changes.rejected.length > 0) {
      const fresh = await prisma.alimtalkBrandTemplate.findMany({
        where: { brandChannelId: local.id, templateCode: { in: [...BRAND_CHANNEL_TEMPLATE_CODES] } },
      });
      const remaining = fresh
        .filter((row) => row.status !== 'APPROVED')
        .map((row) => ({ name: brandTemplateLabel(row.templateCode, row.providerTemplateName), status: row.status }));
      if (changes.approved.length > 0) {
        await notifyBrandTemplatesApproved({
          tenantId: local.tenantId,
          tenantName: local.tenant.name,
          brandName: local.operatingCompany.name,
          searchId: local.searchId,
          templateIds: changes.approved.map((row) => row.id),
          approvedNames: changes.approved.map((row) => row.name),
          remaining,
          now,
        });
      }
      if (changes.rejected.length > 0) {
        await notifyBrandTemplatesRejected({
          tenantId: local.tenantId,
          tenantName: local.tenant.name,
          brandName: local.operatingCompany.name,
          searchId: local.searchId,
          rejected: changes.rejected,
          now,
        });
      }
    }
  }
  await prisma.platformBillingSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', alimtalkBrandChannelLastCheckedAt: now },
    update: { alimtalkBrandChannelLastCheckedAt: now },
  });
  lastCheckedAt = now.toISOString();
  if (gone.length > 0) {
    await sendAlimtalkOpsMail(
      '[청소비서] 카카오 채널 연결이 끊어졌습니다',
      ['발송 서비스 채널 목록에서 사라진 브랜드입니다.', '', ...gone].join('\n'),
    );
  }
  return { checked: locals.length, disconnected: gone.length };
}

async function ensureReadyTemplates(brandChannelId: string): Promise<void> {
  for (const templateCode of BRAND_CHANNEL_TEMPLATE_CODES) {
    const providerTemplateName = BAROBILL_TEMPLATE_NAME_BY_CODE[templateCode];
    await prisma.alimtalkBrandTemplate.upsert({
      where: { brandChannelId_templateCode: { brandChannelId, templateCode } },
      create: { brandChannelId, templateCode, providerTemplateName, status: 'READY' },
      update: {},
    });
  }
}

async function refreshTemplates(
  brandChannelId: string,
  tenantId: string,
  channelId: string,
  now: Date,
): Promise<{
  approved: { id: string; name: string }[];
  rejected: { id: string; name: string; reason: string }[];
}> {
  const approved: { id: string; name: string }[] = [];
  const rejected: { id: string; name: string; reason: string }[] = [];
  let remote: BarobillKakaoTemplate[] = [];
  try {
    remote = await getTemplates(channelId);
  } catch {
    return { approved, rejected };
  }
  const rows = await prisma.alimtalkBrandTemplate.findMany({
    where: { brandChannelId, templateCode: { in: [...BRAND_CHANNEL_TEMPLATE_CODES] } },
  });
  for (const row of rows) {
    const hit = remote.find((item) => item.TemplateName.trim() === row.providerTemplateName.trim());
    if (!hit) {
      await prisma.alimtalkBrandTemplate.updateMany({
        where: { id: row.id, brandChannel: { id: brandChannelId, tenantId } },
        data: { lastCheckedAt: now },
      });
      continue;
    }
    const status = mapProviderTemplateStatus(hit.Status);
    const reason = status === 'REJECTED' ? row.rejectReason || '카카오 심사에서 반려되었습니다.' : null;
    await prisma.alimtalkBrandTemplate.updateMany({
      where: { id: row.id, brandChannel: { id: brandChannelId, tenantId } },
      data: {
        status,
        content: hit.TemplateContent,
        title: hit.TemplateTitle,
        extra: hit.TemplateExtra,
        buttonsJson: hit.Buttons,
        messageType: hit.TemplateMessageType,
        emphasizeType: hit.TemplateEmphasizeType,
        rejectReason: reason,
        submittedAt: status === 'IN_REVIEW' || status === 'APPROVED' ? row.submittedAt ?? now : row.submittedAt,
        approvedAt: status === 'APPROVED' ? row.approvedAt ?? now : row.approvedAt,
        lastCheckedAt: now,
      },
    });
    const name = brandTemplateLabel(row.templateCode, row.providerTemplateName);
    if (status === 'APPROVED' && row.status !== 'APPROVED' && !row.approvedAt && !row.approvedNotifiedAt) {
      approved.push({ id: row.id, name });
    }
    if (status === 'REJECTED' && row.status !== 'REJECTED' && !row.rejectedNotifiedAt) {
      rejected.push({ id: row.id, name, reason: reason ?? '카카오 심사에서 반려되었습니다.' });
    }
  }
  const approvedCount = await prisma.alimtalkBrandTemplate.count({
    where: { brandChannelId, status: 'APPROVED', templateCode: { in: [...BRAND_CHANNEL_TEMPLATE_CODES] } },
  });
  if (approvedCount > 0) {
    await prisma.alimtalkBrandChannel.updateMany({
      where: { id: brandChannelId, tenantId, status: { in: ['LINKED', 'REQUESTED'] } },
      data: { status: 'ACTIVE' },
    });
  }
  return { approved, rejected };
}

export function startAlimtalkBrandChannelSync(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void syncAlimtalkBrandChannels()
      .then((summary) => {
        if (summary.checked > 0) console.info('[alimtalk-brand-channel] sync', summary);
      })
      .catch((err) => {
        console.error('[alimtalk-brand-channel] sync failed', err instanceof Error ? err.name : 'error');
      })
      .finally(() => {
        running = false;
      });
  };
  timer = setInterval(tick, HOUR_MS);
  timer.unref();
}

export type { BarobillKakaoChannel };
